from __future__ import annotations

from django.db.models import Q
from django.http import FileResponse
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, OpenApiRequest, OpenApiResponse, extend_schema, extend_schema_view
from rest_framework import filters, mixins, parsers, renderers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.openapi import (
    AI_MODEL,
    ASSISTANT,
    ASSISTANT_MESSAGE,
    ATTACHMENT,
    ATTACHMENT_FILE_MISSING_ERROR,
    CONVERSATION,
    CONVERSATION_DELETED_ERROR,
    MODEL_IN_USE_ERROR,
    NOT_FOUND_ERROR,
    PAGINATED_ASSISTANTS,
    PAGINATED_CONVERSATIONS,
    PAGINATED_MESSAGES,
    PAGINATED_MODELS,
    PAGINATED_PROJECTS,
    PERMISSION_DENIED_ERROR,
    PREMIUM_REQUIRED_ERROR,
    PROJECT,
    QUOTA_EXCEEDED_ERROR,
    USER_MESSAGE,
    VALIDATION_ERROR,
    example,
    x_examples,
)
from config.exceptions import APIError, AttachmentFileMissing, ModelInUse

from .models import AIModel, Assistant, Attachment, Conversation, Message, Project
from .permissions import AssistantPermission, IsSuperUserOrReadOnly
from .serializers import (
    AIModelSerializer,
    AssistantSerializer,
    AttachmentSerializer,
    ConversationSerializer,
    MessageSendResponseSerializer,
    MessageSendSerializer,
    MessageSerializer,
    MessageUpdateSerializer,
    PaginatedAttachmentResponseSerializer,
    PaginatedConversationResponseSerializer,
    PaginatedMessageResponseSerializer,
    ProjectSerializer,
)
from .services import (
    archive_conversation,
    create_user_message_with_reply,
    ensure_conversation_not_deleted,
    ensure_user_message_mutable,
    restore_conversation,
    soft_delete_conversation,
)
from .throttles import DailyFreeMessageThrottle


NO_CONTENT_RESPONSE = OpenApiResponse(description="No Content.")


class BinaryFileRenderer(renderers.BaseRenderer):
    media_type = "application/octet-stream"
    format = "bin"
    charset = None
    render_style = "binary"

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return b""
        if isinstance(data, bytes):
            return data
        return renderers.JSONRenderer().render(data, accepted_media_type="application/json", renderer_context=renderer_context)


MESSAGE_SEND_JSON_SCHEMA = {
    "type": "object",
    "properties": {
        "content": {"type": "string"},
    },
}
MESSAGE_SEND_MULTIPART_SCHEMA = {
    "type": "object",
    "properties": {
        "content": {"type": "string"},
        "file": {"type": "string", "format": "binary"},
        "files": {
            "type": "array",
            "items": {"type": "string", "format": "binary"},
        },
    },
}
SEND_JSON_REQUEST = OpenApiExample(
    "Send JSON message",
    value={"content": "Hello"},
    request_only=True,
    media_type="application/json",
)
MULTIPART_UPLOAD_REQUEST = OpenApiExample(
    "Premium file upload",
    value={"content": "Please inspect this file.", "file": "notes.txt"},
    request_only=True,
    media_type="multipart/form-data",
)
MULTIPART_UPLOAD_RESPONSE = OpenApiExample(
    "Premium file upload response",
    value={
        "user_message": {
            **USER_MESSAGE,
            "content": "Please inspect this file.",
            "attachments": [ATTACHMENT],
        },
        "assistant_message": {
            **ASSISTANT_MESSAGE,
            "content": '[Mock response from GPT-3.5 Turbo] I received your message: "Please inspect this file.".',
        },
    },
    response_only=True,
    status_codes=["201"],
)
OVERSIZED_FILE_ERROR = OpenApiExample(
    "oversized_file",
    value={
        "error": {
            "code": "validation_error",
            "message": "The request contains invalid data.",
            "details": {"files": ["File exceeds 10 MB: too-large.txt"]},
        },
        "request_id": "f3d6e3ce-32e8-4adc-9cf6-863a1b6fa4f2",
    },
    response_only=True,
    status_codes=["400"],
)


def error_response(description: str, *examples):
    return OpenApiResponse(OpenApiTypes.OBJECT, description=description, examples=list(examples))


def apply_safe_ordering(queryset, ordering_value: str | None, allowed_fields: set[str], default_ordering: tuple[str, ...]):
    requested = [field.strip() for field in (ordering_value or "").split(",") if field.strip()]
    valid_fields = [field for field in requested if field.lstrip("-") in allowed_fields]
    return queryset.order_by(*(valid_fields or default_ordering))


@extend_schema_view(
    list=extend_schema(
        tags=["AI Models"],
        examples=[example("AI model list", AI_MODEL, response_only=True, status_codes=["200"])],
        extensions=x_examples(("AI model list", PAGINATED_MODELS)),
    ),
    retrieve=extend_schema(
        tags=["AI Models"],
        examples=[example("AI model", AI_MODEL, response_only=True, status_codes=["200"]), NOT_FOUND_ERROR],
        extensions=x_examples(("AI model", AI_MODEL), ("Not found", NOT_FOUND_ERROR.value)),
    ),
    create=extend_schema(
        tags=["AI Models"],
        examples=[
            OpenApiExample(
                "Create model",
                value={"name": "GPT-4.1", "provider": "OpenAI", "is_active": True, "minimum_subscription": "PREMIUM"},
                request_only=True,
            ),
            example("Created model", {**AI_MODEL, "id": 4, "name": "GPT-4.1"}, response_only=True, status_codes=["201"]),
            PERMISSION_DENIED_ERROR,
            VALIDATION_ERROR,
        ],
        extensions=x_examples(
            ("Create model request", {"name": "GPT-4.1", "provider": "OpenAI", "is_active": True, "minimum_subscription": "PREMIUM"}),
            ("Created model", {**AI_MODEL, "id": 4, "name": "GPT-4.1"}),
            ("Permission denied", PERMISSION_DENIED_ERROR.value),
        ),
        description="Superuser only.",
    ),
    partial_update=extend_schema(
        tags=["AI Models"],
        examples=[
            OpenApiExample("Patch model", value={"is_active": False}, request_only=True),
            example("Updated model", {**AI_MODEL, "is_active": False}, response_only=True, status_codes=["200"]),
            PERMISSION_DENIED_ERROR,
            NOT_FOUND_ERROR,
        ],
        extensions=x_examples(
            ("Patch model request", {"is_active": False}),
            ("Updated model", {**AI_MODEL, "is_active": False}),
            ("Permission denied", PERMISSION_DENIED_ERROR.value),
        ),
        description="Superuser only.",
    ),
    destroy=extend_schema(
        tags=["AI Models"],
        responses={
            204: NO_CONTENT_RESPONSE,
            403: error_response("Permission denied.", PERMISSION_DENIED_ERROR),
            404: error_response("Model not found.", NOT_FOUND_ERROR),
            409: error_response("Model is referenced by existing conversations.", MODEL_IN_USE_ERROR),
        },
        description="Superuser only. Referenced models return model_in_use instead of a server error.",
    ),
)
class AIModelViewSet(viewsets.ModelViewSet):
    serializer_class = AIModelSerializer
    permission_classes = [IsAuthenticated, IsSuperUserOrReadOnly]
    queryset = AIModel.objects.all()
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def perform_destroy(self, instance):
        conversation_count = instance.conversations.count()
        if conversation_count:
            raise ModelInUse(details={"model_id": instance.pk, "conversation_count": conversation_count})
        instance.delete()


@extend_schema_view(
    list=extend_schema(
        tags=["Assistants"],
        examples=[example("Assistant list", ASSISTANT, response_only=True, status_codes=["200"])],
        extensions=x_examples(("Assistant list", PAGINATED_ASSISTANTS)),
    ),
    retrieve=extend_schema(
        tags=["Assistants"],
        examples=[example("Assistant", ASSISTANT, response_only=True, status_codes=["200"]), NOT_FOUND_ERROR],
        extensions=x_examples(("Assistant", ASSISTANT), ("Not found", NOT_FOUND_ERROR.value)),
    ),
    create=extend_schema(
        tags=["Assistants"],
        examples=[
            OpenApiExample(
                "Create private assistant",
                value={
                    "title": "Study Coach",
                    "description": "Helps plan study sessions.",
                    "system_prompt": "Be concise and supportive.",
                    "is_public": False,
                },
                request_only=True,
            ),
            example("Created assistant", {**ASSISTANT, "id": 4, "title": "Study Coach", "is_public": False, "owner_id": 1}, response_only=True, status_codes=["201"]),
            VALIDATION_ERROR,
        ],
        extensions=x_examples(
            ("Create private assistant request", {"title": "Study Coach", "description": "Helps plan study sessions.", "system_prompt": "Be concise and supportive.", "is_public": False}),
            ("Created assistant", {**ASSISTANT, "id": 4, "title": "Study Coach", "is_public": False, "owner_id": 1}),
        ),
    ),
    partial_update=extend_schema(
        tags=["Assistants"],
        examples=[
            OpenApiExample("Patch assistant", value={"description": "Updated helper."}, request_only=True),
            example("Updated assistant", {**ASSISTANT, "description": "Updated helper."}, response_only=True, status_codes=["200"]),
            PERMISSION_DENIED_ERROR,
            NOT_FOUND_ERROR,
        ],
        extensions=x_examples(
            ("Patch assistant request", {"description": "Updated helper."}),
            ("Updated assistant", {**ASSISTANT, "description": "Updated helper."}),
            ("Permission denied", PERMISSION_DENIED_ERROR.value),
        ),
    ),
    destroy=extend_schema(
        tags=["Assistants"],
        responses={
            204: NO_CONTENT_RESPONSE,
            403: error_response("Permission denied.", PERMISSION_DENIED_ERROR),
            404: error_response("Assistant not found.", NOT_FOUND_ERROR),
        },
    ),
)
class AssistantViewSet(viewsets.ModelViewSet):
    serializer_class = AssistantSerializer
    permission_classes = [IsAuthenticated, AssistantPermission]
    queryset = Assistant.objects.all()
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        return Assistant.objects.filter(Q(is_public=True) | Q(owner=user))

    def perform_create(self, serializer):
        is_public = bool(serializer.validated_data.get("is_public")) and self.request.user.is_superuser
        serializer.save(owner=None if is_public else self.request.user, is_public=is_public)

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.is_public:
            serializer.save(owner=None, is_public=True)
        else:
            serializer.save(owner=instance.owner, is_public=False)


@extend_schema_view(
    list=extend_schema(
        tags=["Projects"],
        parameters=[
            OpenApiParameter("search", str, description="Search title and description."),
            OpenApiParameter("ordering", str, description="One of created_at, updated_at, title, with optional '-'."),
        ],
        examples=[example("Project list", PROJECT, response_only=True, status_codes=["200"])],
        extensions=x_examples(("Project list", PAGINATED_PROJECTS)),
    ),
    retrieve=extend_schema(
        tags=["Projects"],
        examples=[example("Project", PROJECT, response_only=True, status_codes=["200"]), NOT_FOUND_ERROR],
        extensions=x_examples(("Project", PROJECT), ("Not found", NOT_FOUND_ERROR.value)),
    ),
    create=extend_schema(
        tags=["Projects"],
        examples=[
            OpenApiExample("Create project", value={"title": "Coursework", "description": "Homework conversations."}, request_only=True),
            example("Created project", PROJECT, response_only=True, status_codes=["201"]),
            VALIDATION_ERROR,
        ],
        extensions=x_examples(
            ("Create project request", {"title": "Coursework", "description": "Homework conversations."}),
            ("Created project", PROJECT),
            ("Validation error", VALIDATION_ERROR.value),
        ),
    ),
    partial_update=extend_schema(
        tags=["Projects"],
        examples=[
            OpenApiExample("Patch project", value={"description": "Updated notes."}, request_only=True),
            example("Updated project", {**PROJECT, "description": "Updated notes."}, response_only=True, status_codes=["200"]),
            NOT_FOUND_ERROR,
        ],
        extensions=x_examples(("Patch project request", {"description": "Updated notes."}), ("Updated project", {**PROJECT, "description": "Updated notes."})),
    ),
    destroy=extend_schema(
        tags=["Projects"],
        responses={
            204: NO_CONTENT_RESPONSE,
            404: error_response("Project not found.", NOT_FOUND_ERROR),
        },
    ),
)
class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    queryset = Project.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "updated_at", "title"]
    ordering = ["-updated_at"]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return Project.objects.filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    @extend_schema(
        responses={
            200: OpenApiResponse(
                PaginatedConversationResponseSerializer,
                examples=[example("Project conversations", PAGINATED_CONVERSATIONS, response_only=True, status_codes=["200"])],
            )
        },
        examples=[NOT_FOUND_ERROR],
        extensions=x_examples(("Project conversations", PAGINATED_CONVERSATIONS), ("Not found", NOT_FOUND_ERROR.value)),
        tags=["Projects"],
        filters=False,
        parameters=[
            OpenApiParameter("page", int, description="A page number within the paginated result set."),
            OpenApiParameter("search", str, description="Search conversation title."),
            OpenApiParameter("ordering", str, description="One of created_at, updated_at, last_message_at, title, with optional '-'."),
        ],
        description="List non-deleted conversations in this project.",
    )
    @action(detail=True, methods=["get"], url_path="conversations")
    def conversations(self, request, pk=None):
        try:
            project = Project.objects.get(pk=pk, owner=request.user)
        except Project.DoesNotExist:
            raise NotFound()
        queryset = project.conversations.filter(owner=request.user).exclude(status=Conversation.Status.DELETED)
        search = (request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(title__icontains=search)
        queryset = apply_safe_ordering(
            queryset,
            request.query_params.get("ordering"),
            {"created_at", "updated_at", "last_message_at", "title"},
            ("-last_message_at", "-created_at"),
        )
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = ConversationSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)
        serializer = ConversationSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)


@extend_schema_view(
    list=extend_schema(
        tags=["Conversations"],
        parameters=[
            OpenApiParameter("status", str, description="active, archived, or deleted."),
            OpenApiParameter("search", str, description="Search conversation title."),
            OpenApiParameter("ordering", str, description="created_at, -updated_at, -last_message_at, title."),
        ],
        examples=[example("Conversation list", CONVERSATION, response_only=True, status_codes=["200"])],
        extensions=x_examples(("Conversation list", PAGINATED_CONVERSATIONS)),
    ),
    retrieve=extend_schema(
        tags=["Conversations"],
        examples=[example("Conversation", CONVERSATION, response_only=True, status_codes=["200"]), NOT_FOUND_ERROR],
        extensions=x_examples(("Conversation", CONVERSATION), ("Not found", NOT_FOUND_ERROR.value)),
    ),
    create=extend_schema(
        tags=["Conversations"],
        examples=[
            OpenApiExample("Create conversation", value={"title": "Debug help", "project_id": 1, "ai_model_id": 1, "assistant_id": 1}, request_only=True),
            example("Created conversation", CONVERSATION, response_only=True, status_codes=["201"]),
            VALIDATION_ERROR,
            NOT_FOUND_ERROR,
        ],
        extensions=x_examples(
            ("Create conversation request", {"title": "Debug help", "project_id": 1, "ai_model_id": 1, "assistant_id": 1}),
            ("Created conversation", CONVERSATION),
            ("Not found", NOT_FOUND_ERROR.value),
        ),
    ),
    partial_update=extend_schema(
        tags=["Conversations"],
        examples=[
            OpenApiExample("Patch conversation", value={"title": "Renamed chat", "project_id": None}, request_only=True),
            example("Updated conversation", {**CONVERSATION, "title": "Renamed chat", "project": None}, response_only=True, status_codes=["200"]),
            CONVERSATION_DELETED_ERROR,
            NOT_FOUND_ERROR,
        ],
        extensions=x_examples(
            ("Patch conversation request", {"title": "Renamed chat", "project_id": None}),
            ("Updated conversation", {**CONVERSATION, "title": "Renamed chat", "project": None}),
            ("Conversation deleted", CONVERSATION_DELETED_ERROR.value),
        ),
    ),
    destroy=extend_schema(
        tags=["Conversations"],
        responses={
            204: NO_CONTENT_RESPONSE,
            404: error_response("Conversation not found.", NOT_FOUND_ERROR),
        },
        description="Soft-deletes the conversation.",
    ),
)
class ConversationViewSet(viewsets.ModelViewSet):
    serializer_class = ConversationSerializer
    queryset = Conversation.objects.all()
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title"]
    ordering_fields = ["created_at", "updated_at", "last_message_at", "title"]
    ordering = ["-last_message_at", "-created_at"]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        queryset = Conversation.objects.filter(owner=self.request.user).select_related("project", "ai_model", "assistant")
        if self.action == "list":
            status_param = (self.request.query_params.get("status") or "").upper()
            if status_param:
                valid = {
                    "ACTIVE": Conversation.Status.ACTIVE,
                    "ARCHIVED": Conversation.Status.ARCHIVED,
                    "DELETED": Conversation.Status.DELETED,
                }
                queryset = queryset.filter(status=valid.get(status_param, "__none__"))
            else:
                queryset = queryset.exclude(status=Conversation.Status.DELETED)
        return queryset

    def get_throttles(self):
        if getattr(self, "action", None) == "messages" and self.request.method == "POST":
            return [DailyFreeMessageThrottle()]
        return super().get_throttles()

    def throttled(self, request, wait):
        details = getattr(request, "quota_throttle_details", {"wait": wait})
        raise APIError(
            "Daily message quota exceeded.",
            code="quota_exceeded",
            details=details,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        )

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        ensure_conversation_not_deleted(instance)
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(serializer.data)

    def perform_destroy(self, instance):
        soft_delete_conversation(instance)

    @extend_schema(
        request=None,
        responses={200: ConversationSerializer},
        examples=[
            example("Archived conversation", {**CONVERSATION, "status": "ARCHIVED"}, response_only=True, status_codes=["200"]),
            CONVERSATION_DELETED_ERROR,
            NOT_FOUND_ERROR,
        ],
        extensions=x_examples(("Archived conversation", {**CONVERSATION, "status": "ARCHIVED"}), ("Conversation deleted", CONVERSATION_DELETED_ERROR.value)),
        tags=["Conversations"],
    )
    @action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        conversation = archive_conversation(self.get_object())
        return Response(ConversationSerializer(conversation, context={"request": request}).data)

    @extend_schema(
        request=None,
        responses={200: ConversationSerializer},
        examples=[
            example("Restored conversation", {**CONVERSATION, "status": "ACTIVE", "deleted_at": None}, response_only=True, status_codes=["200"]),
            NOT_FOUND_ERROR,
        ],
        extensions=x_examples(("Restored conversation", {**CONVERSATION, "status": "ACTIVE", "deleted_at": None}), ("Not found", NOT_FOUND_ERROR.value)),
        tags=["Conversations"],
    )
    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, pk=None):
        conversation = restore_conversation(self.get_object())
        return Response(ConversationSerializer(conversation, context={"request": request}).data)

    @extend_schema(
        methods=["GET"],
        responses={
            200: OpenApiResponse(
                PaginatedMessageResponseSerializer,
                examples=[example("Message list", PAGINATED_MESSAGES, response_only=True, status_codes=["200"])],
            )
        },
        examples=[NOT_FOUND_ERROR],
        extensions=x_examples(("Message list", PAGINATED_MESSAGES), ("Not found", NOT_FOUND_ERROR.value)),
        tags=["Messages"],
        filters=False,
        parameters=[OpenApiParameter("page", int, description="A page number within the paginated result set.")],
        description="Paginated oldest-to-newest messages for the conversation.",
    )
    @extend_schema(
        methods=["POST"],
        request={
            "application/json": OpenApiRequest(
                request=MESSAGE_SEND_JSON_SCHEMA,
                examples=[SEND_JSON_REQUEST],
            ),
            "multipart/form-data": OpenApiRequest(
                request=MESSAGE_SEND_MULTIPART_SCHEMA,
                examples=[MULTIPART_UPLOAD_REQUEST],
            ),
        },
        responses={
            201: MessageSendResponseSerializer,
            400: error_response("Validation error, including oversized file uploads.", VALIDATION_ERROR, OVERSIZED_FILE_ERROR),
            403: error_response("Premium subscription or model access is required.", PREMIUM_REQUIRED_ERROR),
            404: error_response("Conversation not found.", NOT_FOUND_ERROR),
            409: error_response("Conversation is deleted.", CONVERSATION_DELETED_ERROR),
            429: error_response("Daily message quota exceeded.", QUOTA_EXCEEDED_ERROR),
        },
        examples=[
            example("Send message response", {"user_message": USER_MESSAGE, "assistant_message": ASSISTANT_MESSAGE}, response_only=True, status_codes=["201"]),
            MULTIPART_UPLOAD_RESPONSE,
            QUOTA_EXCEEDED_ERROR,
            PREMIUM_REQUIRED_ERROR,
            CONVERSATION_DELETED_ERROR,
            OVERSIZED_FILE_ERROR,
            VALIDATION_ERROR,
        ],
        extensions=x_examples(
            ("Send JSON message", {"content": "Hello"}),
            ("Premium file upload", {"content": "Please inspect this file.", "file": "notes.txt"}),
            ("Send message response", {"user_message": USER_MESSAGE, "assistant_message": ASSISTANT_MESSAGE}),
            ("Premium file upload response", MULTIPART_UPLOAD_RESPONSE.value),
            ("Quota exceeded", QUOTA_EXCEEDED_ERROR.value),
            ("Premium required", PREMIUM_REQUIRED_ERROR.value),
            ("Oversized file", OVERSIZED_FILE_ERROR.value),
            ("Conversation deleted", CONVERSATION_DELETED_ERROR.value),
        ),
        tags=["Messages"],
    )
    @action(detail=True, methods=["get", "post"], url_path="messages")
    def messages(self, request, pk=None):
        conversation = self.get_object()
        if request.method == "GET":
            queryset = conversation.messages.all().prefetch_related("attachments").order_by("created_at", "id")
            page = self.paginate_queryset(queryset)
            if page is not None:
                serializer = MessageSerializer(page, many=True, context={"request": request})
                return self.get_paginated_response(serializer.data)
            serializer = MessageSerializer(queryset, many=True, context={"request": request})
            return Response(serializer.data)

        payload = {"content": request.data.get("content", "")}
        single_file = request.FILES.get("file")
        if single_file is not None:
            payload["file"] = single_file
        repeated_files = request.FILES.getlist("files")
        if repeated_files:
            payload["files"] = repeated_files
        serializer = MessageSendSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        user_message, assistant_message = create_user_message_with_reply(
            conversation=conversation,
            user=request.user,
            content=serializer.validated_data["content"],
            files=serializer.validated_data["uploaded_files"],
        )
        response_payload = {
            "user_message": MessageSerializer(user_message, context={"request": request}).data,
            "assistant_message": MessageSerializer(assistant_message, context={"request": request}).data,
        }
        return Response(response_payload, status=status.HTTP_201_CREATED)


class MessageViewSet(mixins.UpdateModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    queryset = Message.objects.all()
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser, parsers.FormParser]
    http_method_names = ["patch", "delete", "get", "head", "options"]

    def get_queryset(self):
        return Message.objects.filter(conversation__owner=self.request.user).select_related("conversation").prefetch_related("attachments")

    def get_serializer_class(self):
        if self.action == "partial_update":
            return MessageUpdateSerializer
        return MessageSerializer

    @extend_schema(
        request=MessageUpdateSerializer,
        responses={200: MessageSerializer},
        examples=[
            OpenApiExample("Edit message", value={"content": "Corrected content"}, request_only=True),
            example("Edited message", {**USER_MESSAGE, "content": "Corrected content"}, response_only=True, status_codes=["200"]),
            PERMISSION_DENIED_ERROR,
            NOT_FOUND_ERROR,
            VALIDATION_ERROR,
        ],
        extensions=x_examples(
            ("Edit message request", {"content": "Corrected content"}),
            ("Edited message", {**USER_MESSAGE, "content": "Corrected content"}),
            ("Permission denied", PERMISSION_DENIED_ERROR.value),
        ),
        tags=["Messages"],
    )
    def partial_update(self, request, *args, **kwargs):
        message = self.get_object()
        ensure_user_message_mutable(message)
        serializer = MessageUpdateSerializer(message, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(MessageSerializer(message, context={"request": request}).data)

    @extend_schema(
        responses={
            204: OpenApiResponse(description="Message deleted. No Content."),
            403: error_response("Permission denied.", PERMISSION_DENIED_ERROR),
            404: error_response("Message not found.", NOT_FOUND_ERROR),
        },
        tags=["Messages"],
    )
    def destroy(self, request, *args, **kwargs):
        message = self.get_object()
        ensure_user_message_mutable(message)
        message.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        responses={
            200: OpenApiResponse(
                PaginatedAttachmentResponseSerializer,
                examples=[
                    example(
                        "Attachment list",
                        {"count": 1, "next": None, "previous": None, "results": [ATTACHMENT]},
                        response_only=True,
                        status_codes=["200"],
                    )
                ],
            )
        },
        examples=[NOT_FOUND_ERROR],
        extensions=x_examples(("Attachment list", [ATTACHMENT]), ("Not found", NOT_FOUND_ERROR.value)),
        tags=["Attachments"],
        filters=False,
        parameters=[OpenApiParameter("page", int, description="A page number within the paginated result set.")],
    )
    @action(detail=True, methods=["get"], url_path="attachments")
    def attachments(self, request, pk=None):
        message = self.get_object()
        queryset = message.attachments.all()
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = AttachmentSerializer(page, many=True, context={"request": request})
            return self.get_paginated_response(serializer.data)
        serializer = AttachmentSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)


class AttachmentViewSet(viewsets.GenericViewSet):
    serializer_class = AttachmentSerializer
    queryset = Attachment.objects.all()
    renderer_classes = [BinaryFileRenderer, renderers.JSONRenderer]
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        return Attachment.objects.filter(message__conversation__owner=self.request.user).select_related("message__conversation")

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        if getattr(self, "action", None) == "download" and isinstance(response, Response) and response.status_code >= 400:
            response.accepted_renderer = renderers.JSONRenderer()
            response.accepted_media_type = "application/json"
            response.renderer_context = self.get_renderer_context()
            response["Content-Type"] = "application/json"
        return response

    @extend_schema(
        responses={
            (200, "application/octet-stream"): OpenApiResponse(
                OpenApiTypes.BINARY,
                description="Protected binary attachment stream.",
                examples=[
                    example(
                        "Protected file download",
                        "binary file stream for notes.txt",
                        response_only=True,
                        status_codes=["200"],
                        media_type="application/octet-stream",
                    )
                ],
            ),
            (404, "application/json"): error_response("Attachment not found.", NOT_FOUND_ERROR),
            (410, "application/json"): error_response("Attachment record exists but stored file is missing.", ATTACHMENT_FILE_MISSING_ERROR),
        },
        extensions=x_examples(
            ("Protected file download", {"filename": "notes.txt", "content_type": "text/plain"}),
            ("Not found", NOT_FOUND_ERROR.value),
            ("Attachment file missing", ATTACHMENT_FILE_MISSING_ERROR.value),
        ),
        tags=["Attachments"],
    )
    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        attachment = self.get_object()
        if not attachment.file or not attachment.file.name:
            raise AttachmentFileMissing(details={"attachment_id": attachment.pk, "original_name": attachment.original_name})
        if not attachment.file.storage.exists(attachment.file.name):
            raise AttachmentFileMissing(details={"attachment_id": attachment.pk, "original_name": attachment.original_name})
        try:
            file_handle = attachment.file.open("rb")
        except OSError:
            raise AttachmentFileMissing(details={"attachment_id": attachment.pk, "original_name": attachment.original_name})
        response = FileResponse(
            file_handle,
            as_attachment=True,
            filename=attachment.original_name,
            content_type=attachment.content_type or "application/octet-stream",
        )
        return response
