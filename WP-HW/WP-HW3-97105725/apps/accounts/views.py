from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiExample, OpenApiResponse, extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.views import TokenRefreshView

from apps.core.openapi import (
    AUTH_RESPONSE,
    INVALID_CREDENTIALS_ERROR,
    NOT_FOUND_ERROR,
    USER_PROFILE,
    VALIDATION_ERROR,
    example,
    x_examples,
)

from .serializers import (
    AuthResponseSerializer,
    LinkAccountSerializer,
    LoginSerializer,
    RefreshTokenResponseSerializer,
    RegisterSerializer,
    SwitchAccountSerializer,
    UserProfileSerializer,
    auth_payload,
)


register_example = OpenApiExample(
    "username_only_registration",
    value={
        "username": "danyal_username_only",
        "password": "DemoPass123!",
        "password_confirm": "DemoPass123!",
        "first_name": "Dan",
    },
    request_only=True,
)
email_only_register_example = OpenApiExample(
    "email_only_registration",
    value={
        "email": "danyal_email_only@example.com",
        "password": "DemoPass123!",
        "password_confirm": "DemoPass123!",
        "first_name": "Dan",
    },
    request_only=True,
)
register_with_email_example = OpenApiExample(
    "username_and_email_registration",
    value={
        "username": "danyal_both",
        "email": "danyal_both@example.com",
        "password": "DemoPass123!",
        "password_confirm": "DemoPass123!",
        "first_name": "Dan",
    },
    request_only=True,
)
missing_identity_example = OpenApiExample(
    "missing_username_and_email",
    value={
        "error": {
            "code": "validation_error",
            "message": "The request contains invalid data.",
            "details": {"non_field_errors": ["Provide at least one of username or email."]},
        },
        "request_id": "f3d6e3ce-32e8-4adc-9cf6-863a1b6fa4f2",
    },
    response_only=True,
    status_codes=["400"],
)

auth_response_example = example("Auth response", AUTH_RESPONSE, response_only=True, status_codes=["200", "201"])
profile_response_example = example("Profile response", USER_PROFILE, response_only=True, status_codes=["200"])
refresh_request_example = OpenApiExample(
    "Refresh access token",
    value={"refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."},
    request_only=True,
)
refresh_response_example = OpenApiExample(
    "New access token",
    value={"access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."},
    response_only=True,
    status_codes=["200"],
)
REFRESH_INVALID_PAYLOAD = {
    "error": {
        "code": "authentication_failed",
        "message": "Authentication credentials were not provided or are invalid.",
        "details": {},
    },
    "request_id": "f3d6e3ce-32e8-4adc-9cf6-863a1b6fa4f2",
}
refresh_invalid_example = OpenApiExample(
    "Invalid refresh token",
    value=REFRESH_INVALID_PAYLOAD,
    response_only=True,
    status_codes=["401"],
)


class DocumentedTokenRefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=TokenRefreshSerializer,
        responses={200: RefreshTokenResponseSerializer},
        examples=[refresh_request_example, refresh_response_example, refresh_invalid_example, VALIDATION_ERROR],
        extensions=x_examples(
            ("Refresh request", {"refresh": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}),
            ("Refresh response", {"access": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}),
            ("Invalid refresh token", REFRESH_INVALID_PAYLOAD),
            ("Validation error", VALIDATION_ERROR.value),
        ),
        tags=["Auth"],
        description=(
            "Submit a refresh token manually to receive a new access token. "
            "Swagger Authorize uses access tokens only. Access tokens expire after 30 minutes."
        ),
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=RegisterSerializer,
        responses={
            201: AuthResponseSerializer,
            400: OpenApiResponse(
                OpenApiTypes.OBJECT,
                description="Validation error.",
                examples=[missing_identity_example, VALIDATION_ERROR],
            ),
        },
        examples=[
            register_example,
            email_only_register_example,
            register_with_email_example,
            auth_response_example,
            missing_identity_example,
            VALIDATION_ERROR,
        ],
        extensions=x_examples(
            ("username_only_registration", register_example.value),
            ("email_only_registration", email_only_register_example.value),
            ("username_and_email_registration", register_with_email_example.value),
            ("Register success", AUTH_RESPONSE),
            ("missing_username_and_email", missing_identity_example.value),
            ("Validation error", VALIDATION_ERROR.value),
        ),
        tags=["Auth"],
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(auth_payload(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=LoginSerializer,
        responses={200: AuthResponseSerializer},
        examples=[
            OpenApiExample(
                "Login request",
                value={"identifier": "free_demo", "password": "DemoPass123!"},
                request_only=True,
            ),
            auth_response_example,
            INVALID_CREDENTIALS_ERROR,
        ],
        extensions=x_examples(("Login success", AUTH_RESPONSE), ("Invalid credentials", INVALID_CREDENTIALS_ERROR.value)),
        tags=["Auth"],
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return Response(auth_payload(serializer.validated_data["user"]))


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserProfileSerializer
    http_method_names = ["get", "patch", "head", "options"]

    def get_object(self):
        return self.request.user

    @extend_schema(
        responses={200: UserProfileSerializer},
        examples=[profile_response_example],
        extensions=x_examples(("Profile response", USER_PROFILE)),
        tags=["Auth"],
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    @extend_schema(
        request=UserProfileSerializer,
        responses={200: UserProfileSerializer},
        examples=[
            OpenApiExample(
                "Patch profile",
                value={"first_name": "Updated", "last_name": "Name", "email": "new@example.com"},
                request_only=True,
            ),
            example(
                "Updated profile",
                {**USER_PROFILE, "first_name": "Updated", "email": "new@example.com"},
                response_only=True,
                status_codes=["200"],
            ),
            VALIDATION_ERROR,
        ],
        extensions=x_examples(
            ("Patch profile request", {"first_name": "Updated", "last_name": "Name", "email": "new@example.com"}),
            ("Updated profile", {**USER_PROFILE, "first_name": "Updated", "email": "new@example.com"}),
            ("Validation error", VALIDATION_ERROR.value),
        ),
        tags=["Auth"],
    )
    def patch(self, request, *args, **kwargs):
        return super().patch(request, *args, **kwargs)


class LinkAccountView(APIView):
    @extend_schema(
        request=LinkAccountSerializer,
        responses={200: UserProfileSerializer},
        examples=[
            OpenApiExample(
                "Link account",
                value={"identifier": "premium@example.com", "password": "DemoPass123!"},
                request_only=True,
            ),
            example(
                "Linked account profile",
                {**USER_PROFILE, "id": 2, "username": "premium_demo", "email": "premium@example.com", "subscription_type": "PREMIUM"},
                response_only=True,
                status_codes=["200"],
            ),
            VALIDATION_ERROR,
            INVALID_CREDENTIALS_ERROR,
        ],
        extensions=x_examples(
            ("Link account request", {"identifier": "premium@example.com", "password": "DemoPass123!"}),
            ("Linked account profile", {**USER_PROFILE, "id": 2, "username": "premium_demo", "email": "premium@example.com", "subscription_type": "PREMIUM"}),
            ("Invalid credentials", INVALID_CREDENTIALS_ERROR.value),
        ),
        tags=["Auth"],
    )
    def post(self, request):
        serializer = LinkAccountSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        linked = serializer.save()
        return Response(UserProfileSerializer(linked).data)


class LinkedAccountsView(APIView):
    @extend_schema(
        responses={200: UserProfileSerializer(many=True)},
        examples=[
            example(
                "Linked accounts",
                [{**USER_PROFILE, "id": 2, "username": "premium_demo", "email": "premium@example.com", "subscription_type": "PREMIUM"}],
                response_only=True,
                status_codes=["200"],
            )
        ],
        extensions=x_examples(
            ("Linked accounts", [{**USER_PROFILE, "id": 2, "username": "premium_demo", "email": "premium@example.com", "subscription_type": "PREMIUM"}])
        ),
        tags=["Auth"],
    )
    def get(self, request):
        return Response(UserProfileSerializer(request.user.linked_accounts.all(), many=True).data)


class SwitchAccountView(APIView):
    @extend_schema(
        request=SwitchAccountSerializer,
        responses={200: AuthResponseSerializer},
        examples=[
            OpenApiExample("Switch account", value={"account_id": 2}, request_only=True),
            example(
                "Switched account response",
                {
                    **AUTH_RESPONSE,
                    "user": {**USER_PROFILE, "id": 2, "username": "premium_demo", "email": "premium@example.com", "subscription_type": "PREMIUM"},
                },
                response_only=True,
                status_codes=["200"],
            ),
            NOT_FOUND_ERROR,
        ],
        extensions=x_examples(
            ("Switch account request", {"account_id": 2}),
            ("Switched account response", {**AUTH_RESPONSE, "user": {**USER_PROFILE, "id": 2, "username": "premium_demo", "email": "premium@example.com", "subscription_type": "PREMIUM"}}),
            ("Not found", NOT_FOUND_ERROR.value),
        ),
        tags=["Auth"],
    )
    def post(self, request):
        serializer = SwitchAccountSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        target = serializer.save()
        return Response(auth_payload(target))
