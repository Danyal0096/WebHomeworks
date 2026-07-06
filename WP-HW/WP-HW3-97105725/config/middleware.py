import re
import uuid


REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")


class RequestIDMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        incoming = request.headers.get("X-Request-ID", "")
        request_id = incoming if REQUEST_ID_RE.match(incoming) else str(uuid.uuid4())
        request.request_id = request_id
        request.META["HTTP_X_REQUEST_ID"] = request_id

        response = self.get_response(request)
        response["X-Request-ID"] = request_id
        return response
