from __future__ import annotations

from collections.abc import Iterable

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status

from apps.accounts.models import User
from config.exceptions import APIError, AssistantNotAvailable, ConversationDeleted, ModelNotAvailable, PremiumRequired

from .models import AIModel, Assistant, Attachment, Conversation, Message, Project


MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024


def generated_conversation_title() -> str:
    return f"New conversation - {timezone.localtime().strftime('%Y-%m-%d %H:%M')}"


def user_can_use_model(user: User, ai_model: AIModel) -> bool:
    if not ai_model.is_active:
        return False
    if ai_model.minimum_subscription == User.SubscriptionType.PREMIUM:
        return user.subscription_type == User.SubscriptionType.PREMIUM
    return True


def validate_model_access(user: User, ai_model: AIModel) -> AIModel:
    if not user_can_use_model(user, ai_model):
        raise ModelNotAvailable(
            details={
                "model_id": ai_model.pk,
                "minimum_subscription": ai_model.minimum_subscription,
                "user_subscription": user.subscription_type,
            }
        )
    return ai_model


def validate_project_owner(user: User, project: Project | None) -> Project | None:
    if project is not None and project.owner_id != user.id:
        raise serializers.ValidationError({"project_id": ["Project does not exist."]})
    return project


def validate_assistant_access(user: User, assistant: Assistant | None) -> Assistant | None:
    if assistant is None:
        return None
    if assistant.is_public or assistant.owner_id == user.id:
        return assistant
    raise AssistantNotAvailable()


def mock_reply_for(conversation: Conversation, content: str) -> str:
    preview = content if content else "[attachment only]"
    reply = f'[Mock response from {conversation.ai_model.name}] I received your message: "{preview}".'
    if conversation.assistant:
        reply += f" Assistant: {conversation.assistant.title}."
    return reply


def validate_message_payload(content: str, files: Iterable) -> None:
    has_content = bool((content or "").strip())
    has_files = any(True for _ in files)
    if not has_content and not has_files:
        raise serializers.ValidationError({"content": ["Provide content or at least one file."]})


def validate_attachment_entitlement(user: User, files: list) -> None:
    if not files:
        return
    if user.subscription_type != User.SubscriptionType.PREMIUM:
        raise PremiumRequired()
    too_large = [file.name for file in files if file.size > MAX_ATTACHMENT_BYTES]
    if too_large:
        raise APIError(
            "One or more files exceed the 10 MB upload limit.",
            code="validation_error",
            details={"files": [f"File exceeds 10 MB: {name}" for name in too_large]},
        )


@transaction.atomic
def create_user_message_with_reply(
    *,
    conversation: Conversation,
    user: User,
    content: str,
    files: list,
) -> tuple[Message, Message]:
    if conversation.status == Conversation.Status.DELETED:
        raise ConversationDeleted()
    validate_model_access(user, conversation.ai_model)
    validate_message_payload(content, list(files))
    validate_attachment_entitlement(user, files)

    user_message = Message.objects.create(
        conversation=conversation,
        role=Message.Role.USER,
        content=content or "",
    )
    for uploaded_file in files:
        Attachment.objects.create(
            message=user_message,
            file=uploaded_file,
            original_name=uploaded_file.name,
            content_type=getattr(uploaded_file, "content_type", "") or "",
            size_bytes=uploaded_file.size,
        )

    assistant_message = Message.objects.create(
        conversation=conversation,
        role=Message.Role.ASSISTANT,
        content=mock_reply_for(conversation, content or ""),
    )
    conversation.last_message_at = assistant_message.created_at
    conversation.save(update_fields=["last_message_at", "updated_at"])
    return user_message, assistant_message


def soft_delete_conversation(conversation: Conversation) -> Conversation:
    conversation.status = Conversation.Status.DELETED
    conversation.deleted_at = timezone.now()
    conversation.save(update_fields=["status", "deleted_at", "updated_at"])
    return conversation


def archive_conversation(conversation: Conversation) -> Conversation:
    ensure_conversation_not_deleted(conversation)
    conversation.status = Conversation.Status.ARCHIVED
    conversation.save(update_fields=["status", "updated_at"])
    return conversation


def restore_conversation(conversation: Conversation) -> Conversation:
    conversation.status = Conversation.Status.ACTIVE
    conversation.deleted_at = None
    conversation.save(update_fields=["status", "deleted_at", "updated_at"])
    return conversation


def ensure_conversation_not_deleted(conversation: Conversation) -> None:
    if conversation.status == Conversation.Status.DELETED:
        raise ConversationDeleted()


def ensure_user_message_mutable(message: Message) -> None:
    if message.role != Message.Role.USER:
        raise APIError(
            "Only user messages can be edited or deleted.",
            code="permission_denied",
            status_code=status.HTTP_403_FORBIDDEN,
        )
