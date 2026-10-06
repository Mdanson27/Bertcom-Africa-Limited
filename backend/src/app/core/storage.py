from __future__ import annotations

import boto3

from app.core.settings import settings


def storage_configured() -> bool:
    return bool(
        settings.AWS_ENDPOINT_URL_S3
        and settings.AWS_ACCESS_KEY_ID
        and settings.AWS_SECRET_ACCESS_KEY
        and settings.AWS_REGION
        and settings.DOCUMENTS_BUCKET
    )


def get_storage_client():
    if not storage_configured():
        raise RuntimeError("Neon Object Storage is not configured.")

    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        endpoint_url=settings.AWS_ENDPOINT_URL_S3,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def presign_upload(storage_key: str, content_type: str, expires: int = 600) -> str:
    return get_storage_client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.DOCUMENTS_BUCKET,
            "Key": storage_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires,
    )


def presign_download(storage_key: str, expires: int = 900) -> str:
    return get_storage_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.DOCUMENTS_BUCKET, "Key": storage_key},
        ExpiresIn=expires,
    )


def delete_object(storage_key: str) -> None:
    get_storage_client().delete_object(Bucket=settings.DOCUMENTS_BUCKET, Key=storage_key)


def put_object_bytes(storage_key: str, content: bytes, content_type: str) -> None:
    get_storage_client().put_object(
        Bucket=settings.DOCUMENTS_BUCKET,
        Key=storage_key,
        Body=content,
        ContentType=content_type,
    )
