from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, ClassVar

import structlog
from botocore.exceptions import ClientError
from litestar import Controller, Request, delete, get, patch, post
from litestar.exceptions import ClientException, NotFoundException
from litestar.status_codes import HTTP_200_OK, HTTP_201_CREATED
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.storage import delete_object, presign_download, presign_upload, storage_configured
from app.domain.workspace.models import Document, Project, ProjectTask
from app.domain.workspace.schemas import (
    DocumentCreate,
    DocumentPresignRequest,
    DocumentPresignResponse,
    DocumentRead,
    DocumentUpdate,
    DownloadResponse,
    ProjectCreate,
    ProjectRead,
    ProjectUpdate,
    TaskCreate,
    TaskRead,
    TaskUpdate,
    WorkspaceSummary,
)
from app.presentation.guards.auth_guard import JWTAuthGuard


logger = structlog.get_logger("app.workspace")


def _email(request: Request) -> str:
    email = str(request.scope.get("email") or "").strip().lower()
    if not email:
        raise ClientException(detail="Authenticated email is required.", status_code=401)
    return email


def _project_read(item: Project) -> ProjectRead:
    return ProjectRead(
        id=item.id,
        name=item.name,
        client_name=item.client_name,
        description=item.description,
        status=item.status,
        value_ugx=float(item.value_ugx or 0),
        amount_paid_ugx=float(item.amount_paid_ugx or 0),
        start_date=item.start_date,
        due_date=item.due_date,
        progress=item.progress,
        project_manager_email=item.project_manager_email,
        created_by_email=item.created_by_email,
        is_archived=item.is_archived,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _task_read(item: ProjectTask) -> TaskRead:
    return TaskRead(
        id=item.id,
        project_id=item.project_id,
        title=item.title,
        description=item.description,
        assignee_email=item.assignee_email,
        status=item.status,
        priority=item.priority,
        due_date=item.due_date,
        completed_at=item.completed_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _document_read(item: Document) -> DocumentRead:
    return DocumentRead(
        id=item.id,
        project_id=item.project_id,
        title=item.title,
        original_filename=item.original_filename,
        category=item.category,
        content_type=item.content_type,
        size_bytes=item.size_bytes,
        storage_key=item.storage_key,
        uploaded_by_email=item.uploaded_by_email,
        ocr_status=item.ocr_status,
        ocr_text=item.ocr_text,
        extracted_fields=dict(item.extracted_fields or {}),
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


class ProjectsController(Controller):
    path = "/projects"
    guards: ClassVar[list[Any]] = [JWTAuthGuard()]

    @get()
    async def list_projects(
        self,
        db_session: AsyncSession,
        q: str | None = None,
        include_archived: bool = False,
    ) -> list[ProjectRead]:
        stmt = select(Project).order_by(Project.updated_at.desc())
        if not include_archived:
            stmt = stmt.where(Project.is_archived.is_(False))
        if q:
            term = f"%{q.strip()}%"
            stmt = stmt.where(or_(Project.name.ilike(term), Project.client_name.ilike(term)))
        rows = (await db_session.execute(stmt)).scalars().all()
        return [_project_read(row) for row in rows]

    @post(status_code=HTTP_201_CREATED)
    async def create_project(
        self,
        request: Request,
        data: ProjectCreate,
        db_session: AsyncSession,
    ) -> ProjectRead:
        if not data.name.strip() or not data.client_name.strip():
            raise ClientException(detail="Project name and client are required.", status_code=400)
        progress = max(0, min(100, data.progress))
        item = Project(
            name=data.name.strip(),
            client_name=data.client_name.strip(),
            description=data.description,
            status=data.status,
            value_ugx=Decimal(str(max(0, data.value_ugx))),
            amount_paid_ugx=Decimal(str(max(0, data.amount_paid_ugx))),
            start_date=data.start_date,
            due_date=data.due_date,
            progress=progress,
            project_manager_email=data.project_manager_email,
            created_by_email=_email(request),
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)
        return _project_read(item)

    @get(path="/{project_id:uuid}")
    async def get_project(self, project_id: uuid.UUID, db_session: AsyncSession) -> ProjectRead:
        item = await db_session.get(Project, project_id)
        if item is None:
            raise NotFoundException(detail="Project not found.")
        return _project_read(item)

    @patch(path="/{project_id:uuid}")
    async def update_project(
        self,
        project_id: uuid.UUID,
        data: ProjectUpdate,
        db_session: AsyncSession,
    ) -> ProjectRead:
        item = await db_session.get(Project, project_id)
        if item is None:
            raise NotFoundException(detail="Project not found.")
        for field in (
            "name",
            "client_name",
            "description",
            "status",
            "start_date",
            "due_date",
            "project_manager_email",
            "is_archived",
        ):
            value = getattr(data, field)
            if value is not None:
                setattr(item, field, value)
        if data.progress is not None:
            item.progress = max(0, min(100, data.progress))
        if data.value_ugx is not None:
            item.value_ugx = Decimal(str(max(0, data.value_ugx)))
        if data.amount_paid_ugx is not None:
            item.amount_paid_ugx = Decimal(str(max(0, data.amount_paid_ugx)))
        await db_session.commit()
        await db_session.refresh(item)
        return _project_read(item)

    @delete(path="/{project_id:uuid}", status_code=HTTP_200_OK)
    async def archive_project(self, project_id: uuid.UUID, db_session: AsyncSession) -> dict:
        item = await db_session.get(Project, project_id)
        if item is None:
            raise NotFoundException(detail="Project not found.")
        item.is_archived = True
        await db_session.commit()
        return {"message": "Project archived."}


class TasksController(Controller):
    path = "/tasks"
    guards: ClassVar[list[Any]] = [JWTAuthGuard()]

    @get()
    async def list_tasks(
        self,
        db_session: AsyncSession,
        project_id: uuid.UUID | None = None,
        status: str | None = None,
    ) -> list[TaskRead]:
        stmt = select(ProjectTask).order_by(ProjectTask.due_date.asc().nullslast(), ProjectTask.created_at.desc())
        if project_id:
            stmt = stmt.where(ProjectTask.project_id == project_id)
        if status:
            stmt = stmt.where(ProjectTask.status == status)
        rows = (await db_session.execute(stmt)).scalars().all()
        return [_task_read(row) for row in rows]

    @post(status_code=HTTP_201_CREATED)
    async def create_task(self, data: TaskCreate, db_session: AsyncSession) -> TaskRead:
        if await db_session.get(Project, data.project_id) is None:
            raise NotFoundException(detail="Project not found.")
        item = ProjectTask(
            project_id=data.project_id,
            title=data.title.strip(),
            description=data.description,
            assignee_email=data.assignee_email,
            status=data.status,
            priority=data.priority,
            due_date=data.due_date,
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)
        return _task_read(item)

    @patch(path="/{task_id:uuid}")
    async def update_task(
        self,
        task_id: uuid.UUID,
        data: TaskUpdate,
        db_session: AsyncSession,
    ) -> TaskRead:
        item = await db_session.get(ProjectTask, task_id)
        if item is None:
            raise NotFoundException(detail="Task not found.")
        for field in ("title", "description", "assignee_email", "priority", "due_date"):
            value = getattr(data, field)
            if value is not None:
                setattr(item, field, value)
        if data.status is not None:
            item.status = data.status
            item.completed_at = datetime.now(UTC) if data.status == "completed" else None
        await db_session.commit()
        await db_session.refresh(item)
        return _task_read(item)


class DocumentsController(Controller):
    path = "/documents"
    guards: ClassVar[list[Any]] = [JWTAuthGuard()]

    @get()
    async def list_documents(
        self,
        db_session: AsyncSession,
        project_id: uuid.UUID | None = None,
        q: str | None = None,
    ) -> list[DocumentRead]:
        stmt = select(Document).order_by(Document.created_at.desc())
        if project_id:
            stmt = stmt.where(Document.project_id == project_id)
        if q:
            term = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Document.title.ilike(term),
                    Document.original_filename.ilike(term),
                    Document.ocr_text.ilike(term),
                )
            )
        rows = (await db_session.execute(stmt)).scalars().all()
        return [_document_read(row) for row in rows]

    @post(path="/presign")
    async def create_upload_url(
        self,
        request: Request,
        data: DocumentPresignRequest,
    ) -> DocumentPresignResponse:
        if not storage_configured():
            raise ClientException(detail="Document storage is not configured.", status_code=503)
        safe_name = re.sub(r"[^A-Za-z0-9._-]+", "-", data.filename).strip("-") or "document"
        owner = re.sub(r"[^A-Za-z0-9._-]+", "-", _email(request))
        project_part = str(data.project_id) if data.project_id else "general"
        storage_key = f"documents/{project_part}/{owner}/{uuid.uuid4()}-{safe_name}"
        return DocumentPresignResponse(
            upload_url=presign_upload(storage_key, data.content_type),
            storage_key=storage_key,
        )

    @post(status_code=HTTP_201_CREATED)
    async def create_document(
        self,
        request: Request,
        data: DocumentCreate,
        db_session: AsyncSession,
    ) -> DocumentRead:
        if data.project_id and await db_session.get(Project, data.project_id) is None:
            raise NotFoundException(detail="Project not found.")
        if not data.storage_key.startswith("documents/"):
            raise ClientException(detail="Invalid document storage key.", status_code=400)
        item = Document(
            project_id=data.project_id,
            title=data.title.strip() or data.original_filename,
            original_filename=data.original_filename,
            category=data.category,
            content_type=data.content_type,
            size_bytes=max(0, data.size_bytes),
            storage_key=data.storage_key,
            uploaded_by_email=_email(request),
            ocr_status=data.ocr_status,
            ocr_text=data.ocr_text,
            extracted_fields=data.extracted_fields,
        )
        db_session.add(item)
        await db_session.commit()
        await db_session.refresh(item)
        return _document_read(item)

    @patch(path="/{document_id:uuid}")
    async def update_document(
        self,
        document_id: uuid.UUID,
        data: DocumentUpdate,
        db_session: AsyncSession,
    ) -> DocumentRead:
        item = await db_session.get(Document, document_id)
        if item is None:
            raise NotFoundException(detail="Document not found.")
        for field in ("title", "category", "project_id", "ocr_status", "ocr_text", "extracted_fields"):
            value = getattr(data, field)
            if value is not None:
                setattr(item, field, value)
        await db_session.commit()
        await db_session.refresh(item)
        return _document_read(item)

    @get(path="/{document_id:uuid}/download")
    async def get_download_url(
        self,
        document_id: uuid.UUID,
        db_session: AsyncSession,
    ) -> DownloadResponse:
        item = await db_session.get(Document, document_id)
        if item is None:
            raise NotFoundException(detail="Document not found.")
        return DownloadResponse(url=presign_download(item.storage_key))

    @delete(path="/{document_id:uuid}", status_code=HTTP_200_OK)
    async def delete_document(self, document_id: uuid.UUID, db_session: AsyncSession) -> dict:
        item = await db_session.get(Document, document_id)
        if item is None:
            raise NotFoundException(detail="Document not found.")
        key = item.storage_key
        await db_session.delete(item)
        await db_session.commit()
        try:
            delete_object(key)
        except ClientError as exc:
            logger.warning(
                "document.storage_delete_failed",
                storage_key=key,
                error=str(exc),
            )
        return {"message": "Document deleted."}


class WorkspaceController(Controller):
    path = "/workspace"
    guards: ClassVar[list[Any]] = [JWTAuthGuard()]

    @get(path="/summary")
    async def summary(self, db_session: AsyncSession) -> WorkspaceSummary:
        today = datetime.now(UTC).date()
        active_projects = int(
            (await db_session.scalar(
                select(func.count()).select_from(Project).where(
                    Project.is_archived.is_(False),
                    Project.status.notin_(["completed", "cancelled"]),
                )
            ))
            or 0
        )
        due_tasks = int(
            (await db_session.scalar(
                select(func.count()).select_from(ProjectTask).where(
                    Project.status.notin_(["completed", "cancelled"]),
                    ProjectTask.status != "completed",
                    ProjectTask.due_date.is_not(None),
                    ProjectTask.due_date <= today,
                ).join(Project, Project.id == ProjectTask.project_id)
            ))
            or 0
        )
        pending_tasks = int(
            (await db_session.scalar(
                select(func.count()).select_from(ProjectTask).where(ProjectTask.status != "completed")
            ))
            or 0
        )
        documents = int((await db_session.scalar(select(func.count()).select_from(Document))) or 0)
        outstanding = await db_session.scalar(
            select(func.coalesce(func.sum(Project.value_ugx - Project.amount_paid_ugx), 0)).where(
                Project.is_archived.is_(False)
            )
        )
        return WorkspaceSummary(
            active_projects=active_projects,
            due_tasks=due_tasks,
            pending_tasks=pending_tasks,
            documents=documents,
            outstanding_ugx=float(outstanding or 0),
        )
