from __future__ import annotations

import uuid
from pathlib import Path

from django.conf import settings
from django.db import models


class SubscriptionLevel(models.TextChoices):
    FREE = "FREE", "Free"
    PREMIUM = "PREMIUM", "Premium"


class Project(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="projects")
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self) -> str:
        return self.title


class AIModel(models.Model):
    name = models.CharField(max_length=100, unique=True)
    provider = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    minimum_subscription = models.CharField(
        max_length=20,
        choices=SubscriptionLevel.choices,
        default=SubscriptionLevel.FREE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Assistant(models.Model):
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    system_prompt = models.TextField()
    is_public = models.BooleanField(default=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="assistants",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(is_public=True, owner__isnull=True)
                    | models.Q(is_public=False, owner__isnull=False)
                ),
                name="assistant_public_owner_consistency",
            )
        ]

    def __str__(self) -> str:
        return self.title


class Conversation(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE", "Active"
        ARCHIVED = "ARCHIVED", "Archived"
        DELETED = "DELETED", "Deleted"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="conversations")
    project = models.ForeignKey(Project, null=True, blank=True, on_delete=models.CASCADE, related_name="conversations")
    ai_model = models.ForeignKey(AIModel, on_delete=models.PROTECT, related_name="conversations")
    assistant = models.ForeignKey(Assistant, null=True, blank=True, on_delete=models.SET_NULL, related_name="conversations")
    title = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_message_at", "-created_at"]

    def __str__(self) -> str:
        return self.title


class Message(models.Model):
    class Role(models.TextChoices):
        USER = "USER", "User"
        SYSTEM = "SYSTEM", "System"
        ASSISTANT = "ASSISTANT", "Assistant"

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=20, choices=Role.choices)
    content = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self) -> str:
        return f"{self.role} message in {self.conversation_id}"


def attachment_upload_to(instance: "Attachment", filename: str) -> str:
    suffix = Path(filename).suffix
    return f"attachments/{uuid.uuid4()}{suffix}"


class Attachment(models.Model):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to=attachment_upload_to)
    original_name = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, blank=True)
    size_bytes = models.PositiveIntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["uploaded_at", "id"]

    def __str__(self) -> str:
        return self.original_name
