from drf_spectacular.utils import OpenApiExample


def example(name, value, *, request_only=False, response_only=False, status_codes=None, media_type=None):
    return OpenApiExample(
        name,
        value=value,
        request_only=request_only,
        response_only=response_only,
        status_codes=status_codes,
        media_type=media_type,
    )


def x_examples(*items):
    return {
        "x-examples": [
            {"name": name, "summary": name, "value": value}
            for name, value in items
        ]
    }


def error_payload(code, message, details=None):
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        },
        "request_id": "f3d6e3ce-32e8-4adc-9cf6-863a1b6fa4f2",
    }


USER_PROFILE = {
    "id": 1,
    "username": "free_demo",
    "email": "free@example.com",
    "first_name": "Free",
    "last_name": "User",
    "subscription_type": "FREE",
}

AUTH_RESPONSE = {
    "user": USER_PROFILE,
    "tokens": {
        "access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    },
}

AI_MODEL = {
    "id": 1,
    "name": "GPT-3.5 Turbo",
    "provider": "OpenAI",
    "is_active": True,
    "minimum_subscription": "FREE",
    "created_at": "2026-06-21T14:32:00+03:30",
    "updated_at": "2026-06-21T14:32:00+03:30",
}

ASSISTANT = {
    "id": 1,
    "title": "General Assistant",
    "description": "General-purpose helpful assistant.",
    "system_prompt": "You are helpful, clear, and concise.",
    "is_public": True,
    "owner_id": None,
    "created_at": "2026-06-21T14:32:00+03:30",
    "updated_at": "2026-06-21T14:32:00+03:30",
}

PROJECT = {
    "id": 1,
    "title": "Coursework",
    "description": "Homework conversations.",
    "created_at": "2026-06-21T14:32:00+03:30",
    "updated_at": "2026-06-21T14:32:00+03:30",
}

CONVERSATION = {
    "id": 1,
    "title": "Debug help",
    "status": "ACTIVE",
    "project": {"id": 1, "title": "Coursework"},
    "ai_model": AI_MODEL,
    "assistant": ASSISTANT,
    "created_at": "2026-06-21T14:32:00+03:30",
    "updated_at": "2026-06-21T14:33:00+03:30",
    "last_message_at": "2026-06-21T14:33:00+03:30",
    "deleted_at": None,
}

ATTACHMENT = {
    "id": 1,
    "original_name": "notes.txt",
    "content_type": "text/plain",
    "size_bytes": 128,
    "uploaded_at": "2026-06-21T14:32:30+03:30",
    "download_url": "http://127.0.0.1:8000/api/attachments/1/download/",
}

USER_MESSAGE = {
    "id": 1,
    "conversation": 1,
    "role": "USER",
    "content": "Hello",
    "attachments": [],
    "created_at": "2026-06-21T14:32:30+03:30",
    "updated_at": "2026-06-21T14:32:30+03:30",
}

ASSISTANT_MESSAGE = {
    "id": 2,
    "conversation": 1,
    "role": "ASSISTANT",
    "content": '[Mock response from GPT-3.5 Turbo] I received your message: "Hello".',
    "attachments": [],
    "created_at": "2026-06-21T14:32:31+03:30",
    "updated_at": "2026-06-21T14:32:31+03:30",
}

PAGINATED_PROJECTS = {"count": 1, "next": None, "previous": None, "results": [PROJECT]}
PAGINATED_CONVERSATIONS = {"count": 1, "next": None, "previous": None, "results": [CONVERSATION]}
PAGINATED_MESSAGES = {"count": 2, "next": None, "previous": None, "results": [USER_MESSAGE, ASSISTANT_MESSAGE]}
PAGINATED_MODELS = {"count": 1, "next": None, "previous": None, "results": [AI_MODEL]}
PAGINATED_ASSISTANTS = {"count": 1, "next": None, "previous": None, "results": [ASSISTANT]}

VALIDATION_ERROR = example(
    "validation_error",
    error_payload(
        "validation_error",
        "The request contains invalid data.",
        {"email": ["This email is already in use."]},
    ),
    response_only=True,
    status_codes=["400"],
)
INVALID_CREDENTIALS_ERROR = example(
    "invalid_credentials",
    error_payload("invalid_credentials", "Invalid username/email or password."),
    response_only=True,
    status_codes=["401"],
)
PERMISSION_DENIED_ERROR = example(
    "permission_denied",
    error_payload("permission_denied", "You do not have permission to perform this action."),
    response_only=True,
    status_codes=["403"],
)
NOT_FOUND_ERROR = example(
    "not_found",
    error_payload("not_found", "The requested resource was not found."),
    response_only=True,
    status_codes=["404"],
)
QUOTA_EXCEEDED_ERROR = example(
    "quota_exceeded",
    error_payload(
        "quota_exceeded",
        "Daily message quota exceeded.",
        {"limit": 50, "used": 50, "remaining": 0},
    ),
    response_only=True,
    status_codes=["429"],
)
PREMIUM_REQUIRED_ERROR = example(
    "premium_required",
    error_payload("premium_required", "A Premium subscription is required for this action."),
    response_only=True,
    status_codes=["403"],
)
MODEL_IN_USE_ERROR = example(
    "model_in_use",
    error_payload(
        "model_in_use",
        "This AI model is referenced by existing conversations and cannot be deleted.",
        {"conversation_count": 3},
    ),
    response_only=True,
    status_codes=["409"],
)
CONVERSATION_DELETED_ERROR = example(
    "conversation_deleted",
    error_payload("conversation_deleted", "Deleted conversations cannot receive messages."),
    response_only=True,
    status_codes=["409"],
)
ATTACHMENT_FILE_MISSING_ERROR = example(
    "attachment_file_missing",
    error_payload(
        "attachment_file_missing",
        "The attachment record exists, but the stored file is missing.",
        {"attachment_id": 1, "original_name": "notes.txt"},
    ),
    response_only=True,
    status_codes=["410"],
)
