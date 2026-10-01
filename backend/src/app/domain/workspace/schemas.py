from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

import msgspec


class ProjectCreate(msgspec.Struct, frozen=True):
    name: str
    client_name: str
    description: str | None = None
    status: str = "planning"
    value_ugx: float = 0
    amount_paid_ugx: float = 0
    start_date: date | None = None
    due_date: date | None = None
    progress: int = 0
    project_manager_email: str | None = None


class ProjectUpdate(msgspec.Struct, frozen=True):
    name: str | None = None
    client_name: str | None = None
    description: str | None = None
    status: str | None = None
    value_ugx: float | None = None
    amount_paid_ugx: float | None = None
    start_date: date | None = None
    due_date: date | None = None
    progress: int | None = None
    project_manager_email: str | None = None
    is_archived: bool | None = None


class ProjectRead(msgspec.Struct, frozen=True):
    id: uuid.UUID
    name: str
    client_name: str
    description: str | None
    status: str
    value_ugx: float
    amount_paid_ugx: float
    start_date: date | None
    due_date: date | None
    progress: int
    project_manager_email: str | None
    created_by_email: str
    is_archived: bool
    created_at: datetime
    updated_at: datetime


class TaskCreate(msgspec.Struct, frozen=True):
    project_id: uuid.UUID
    title: str
    description: str | None = None
    assignee_email: str | None = None
    status: str = "pending"
    priority: str = "normal"
    due_date: date | None = None


class TaskUpdate(msgspec.Struct, frozen=True):
    title: str | None = None
    description: str | None = None
    assignee_email: str | None = None
    status: str | None = None
    priority: str | None = None
    due_date: date | None = None


class TaskRead(msgspec.Struct, frozen=True):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str | None
    assignee_email: str | None
    status: str
    priority: str
    due_date: date | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime


class DocumentPresignRequest(msgspec.Struct, frozen=True):
    filename: str
    content_type: str
    project_id: uuid.UUID | None = None


class DocumentPresignResponse(msgspec.Struct, frozen=True):
    upload_url: str
    storage_key: str
    method: str = "PUT"


class DocumentCreate(msgspec.Struct, frozen=True):
    title: str
    original_filename: str
    category: str
    content_type: str
    size_bytes: int
    storage_key: str
    project_id: uuid.UUID | None = None
    ocr_status: str = "not_requested"
    ocr_text: str | None = None
    extracted_fields: dict[str, Any] = msgspec.field(default_factory=dict)


class DocumentUpdate(msgspec.Struct, frozen=True):
    title: str | None = None
    category: str | None = None
    project_id: uuid.UUID | None = None
    ocr_status: str | None = None
    ocr_text: str | None = None
    extracted_fields: dict[str, Any] | None = None


class DocumentRead(msgspec.Struct, frozen=True):
    id: uuid.UUID
    project_id: uuid.UUID | None
    title: str
    original_filename: str
    category: str
    content_type: str
    size_bytes: int
    storage_key: str
    uploaded_by_email: str
    ocr_status: str
    ocr_text: str | None
    extracted_fields: dict[str, Any]
    created_at: datetime
    updated_at: datetime


class DownloadResponse(msgspec.Struct, frozen=True):
    url: str


class WorkspaceSummary(msgspec.Struct, frozen=True):
    active_projects: int
    due_tasks: int
    pending_tasks: int
    documents: int
    outstanding_ugx: float
