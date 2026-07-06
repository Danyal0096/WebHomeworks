from __future__ import annotations

from django.core.exceptions import ObjectDoesNotExist
from django.db.models import Q
from rest_framework import serializers
from rest_framework.exceptions import NotFound
from rest_framework.reverse import reverse

from .models import AIModel, Assistant, Attachment, Conversation, Message, Project
from .services import generated_conversation_title, validate_assistant_access, validate_model_access


class AIModelSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIModel
        fields = (
            "id",
            "name",
            "provider",
            "is_active",
            "minimum_subscription",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")


class AssistantSerializer(serializers.ModelSerializer):
    owner_id = serializers.IntegerField(source="owner.id", read_only=True, allow_null=True)

    class Meta:
        model = Assistant
        fields = (
            "id",
            "title",
            "description",
            "system_prompt",
            "is_public",
            "owner_id",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "owner_id", "created_at", "updated_at")


class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ("id", "title", "description", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")


class ProjectSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ("id", "title")


class OwnerProjectRelatedField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return Project.objects.none()
        return Project.objects.filter(owner=request.user)

    def to_internal_value(self, data):
        if self.pk_field is not None:
            data = self.pk_field.to_internal_value(data)
        try:
            return self.get_queryset().get(pk=data)
        except ObjectDoesNotExist:
            raise NotFound()
        except (TypeError, ValueError):
            self.fail("incorrect_type", data_type=type(data).__name__)


class AccessibleAssistantRelatedField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        request = self.context.get("request")
        if not request or not request.user or not request.user.is_authenticated:
            return Assistant.objects.none()
        return Assistant.objects.filter(Q(is_public=True) | Q(owner=request.user))

    def to_internal_value(self, data):
        if self.pk_field is not None:
            data = self.pk_field.to_internal_value(data)
        try:
            return self.get_queryset().get(pk=data)
        except ObjectDoesNotExist:
            raise NotFound()
        except (TypeError, ValueError):
            self.fail("incorrect_type", data_type=type(data).__name__)


class ConversationSerializer(serializers.ModelSerializer):
    project = ProjectSummarySerializer(read_only=True)
    project_id = OwnerProjectRelatedField(
        source="project",
        required=False,
        allow_null=True,
        write_only=True,
    )
    ai_model = AIModelSerializer(read_only=True)
    ai_model_id = serializers.PrimaryKeyRelatedField(
        source="ai_model",
        queryset=AIModel.objects.all(),
        required=False,
        write_only=True,
    )
    assistant = AssistantSerializer(read_only=True)
    assistant_id = AccessibleAssistantRelatedField(
        source="assistant",
        required=False,
        allow_null=True,
        write_only=True,
    )

    class Meta:
        model = Conversation
        fields = (
            "id",
            "title",
            "status",
            "project",
            "project_id",
            "ai_model",
            "ai_model_id",
            "assistant",
            "assistant_id",
            "created_at",
            "updated_at",
            "last_message_at",
            "deleted_at",
        )
        read_only_fields = ("id", "status", "created_at", "updated_at", "last_message_at", "deleted_at")
        extra_kwargs = {"title": {"required": False, "allow_blank": True}}

    def validate(self, attrs: dict) -> dict:
        user = self.context["request"].user
        is_create = self.instance is None
        if is_create and "ai_model" not in attrs:
            raise serializers.ValidationError({"ai_model_id": ["This field is required."]})
        if "ai_model" in attrs:
            validate_model_access(user, attrs["ai_model"])
        if "assistant" in attrs:
            validate_assistant_access(user, attrs.get("assistant"))
        return attrs

    def create(self, validated_data: dict) -> Conversation:
        title = (validated_data.get("title") or "").strip() or generated_conversation_title()
        validated_data["title"] = title
        validated_data["owner"] = self.context["request"].user
        return super().create(validated_data)


class AttachmentSerializer(serializers.ModelSerializer):
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Attachment
        fields = ("id", "original_name", "content_type", "size_bytes", "uploaded_at", "download_url")
        read_only_fields = fields

    def get_download_url(self, obj: Attachment) -> str:
        request = self.context.get("request")
        return reverse("attachment-download", args=[obj.pk], request=request)


class PaginatedConversationResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = ConversationSerializer(many=True)


class PaginatedAttachmentResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = AttachmentSerializer(many=True)


class MessageSerializer(serializers.ModelSerializer):
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Message
        fields = ("id", "conversation", "role", "content", "attachments", "created_at", "updated_at")
        read_only_fields = ("id", "conversation", "role", "attachments", "created_at", "updated_at")


class MessageSendSerializer(serializers.Serializer):
    content = serializers.CharField(required=False, allow_blank=True)
    file = serializers.FileField(required=False, write_only=True)
    files = serializers.ListField(child=serializers.FileField(), required=False, write_only=True)

    def validate(self, attrs: dict) -> dict:
        uploaded_files = []
        if attrs.get("file") is not None:
            uploaded_files.append(attrs["file"])
        uploaded_files.extend(attrs.get("files") or [])
        if not (attrs.get("content") or "").strip() and not uploaded_files:
            raise serializers.ValidationError({"content": ["Provide content or at least one file."]})
        attrs["uploaded_files"] = uploaded_files
        attrs["content"] = attrs.get("content", "")
        return attrs


class MessageSendResponseSerializer(serializers.Serializer):
    user_message = MessageSerializer()
    assistant_message = MessageSerializer()


class PaginatedMessageResponseSerializer(serializers.Serializer):
    count = serializers.IntegerField()
    next = serializers.URLField(allow_null=True)
    previous = serializers.URLField(allow_null=True)
    results = MessageSerializer(many=True)


class MessageUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = ("content",)

    def validate_content(self, value: str) -> str:
        has_attachments = self.instance and self.instance.attachments.exists()
        if not value.strip() and not has_attachments:
            raise serializers.ValidationError("Content cannot be blank unless the message has attachments.")
        return value
