from __future__ import annotations

from typing import Any

from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler


class APIError(exceptions.APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = "The request could not be processed."
    default_code = "api_error"

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        details: Any | None = None,
        status_code: int | None = None,
    ) -> None:
        self.app_code = code or self.default_code
        self.details_payload = details
        if status_code is not None:
            self.status_code = status_code
        super().__init__(message or str(self.default_detail), self.app_code)


class InvalidCredentials(APIError):
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = "Invalid username/email or password."
    default_code = "invalid_credentials"


class PremiumRequired(APIError):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "A Premium subscription is required for this action."
    default_code = "premium_required"


class ModelNotAvailable(APIError):
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = "The selected AI model is not available."
    default_code = "model_not_available"


class ModelInUse(APIError):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "This AI model is referenced by existing conversations and cannot be deleted."
    default_code = "model_in_use"


class AssistantNotAvailable(APIError):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = "The selected assistant is not available."
    default_code = "assistant_not_available"


class ConversationDeleted(APIError):
    status_code = status.HTTP_409_CONFLICT
    default_detail = "Deleted conversations cannot receive messages."
    default_code = "conversation_deleted"


class AttachmentFileMissing(APIError):
    status_code = status.HTTP_410_GONE
    default_detail = "The attachment record exists, but the stored file is missing."
    default_code = "attachment_file_missing"


def _code_for_exception(exc: Exception, response: Response) -> str:
    if isinstance(exc, APIError):
        return exc.app_code
    if isinstance(exc, exceptions.ValidationError):
        return "validation_error"
    if isinstance(exc, (exceptions.AuthenticationFailed, exceptions.NotAuthenticated)):
        return "authentication_failed"
    if isinstance(exc, exceptions.PermissionDenied):
        return "permission_denied"
    if isinstance(exc, (exceptions.NotFound, Http404)):
        return "not_found"
    if isinstance(exc, exceptions.Throttled):
        return "quota_exceeded"
    if response.status_code >= 500:
        return "internal_error"
    return "api_error"


def _message_for_code(code: str, exc: Exception) -> str:
    messages = {
        "validation_error": "The request contains invalid data.",
        "authentication_failed": "Authentication credentials were not provided or are invalid.",
        "permission_denied": "You do not have permission to perform this action.",
        "not_found": "The requested resource was not found.",
        "quota_exceeded": "Daily message quota exceeded.",
        "internal_error": "An internal error occurred.",
    }
    if isinstance(exc, APIError):
        return str(exc.detail)
    if code in messages:
        return messages[code]
    detail = getattr(exc, "detail", None)
    if isinstance(detail, str):
        return detail
    return "The request could not be processed."


def _details_for_exception(exc: Exception, response: Response) -> Any:
    if isinstance(exc, APIError):
        return exc.details_payload if exc.details_payload is not None else {}
    if isinstance(exc, exceptions.ValidationError):
        return response.data
    if isinstance(exc, exceptions.Throttled):
        return {"wait": exc.wait}
    data = response.data
    if isinstance(data, dict) and "detail" in data:
        return {}
    return data if data is not None else {}


def custom_exception_handler(exc: Exception, context: dict[str, Any]) -> Response:
    response = exception_handler(exc, context)
    request = context.get("request")
    request_id = getattr(request, "request_id", None) or getattr(request, "META", {}).get("HTTP_X_REQUEST_ID")

    if response is None:
        response = Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    code = _code_for_exception(exc, response)
    response.data = {
        "error": {
            "code": code,
            "message": _message_for_code(code, exc),
            "details": _details_for_exception(exc, response),
        },
        "request_id": request_id,
    }
    if request_id:
        response["X-Request-ID"] = request_id
    return response
