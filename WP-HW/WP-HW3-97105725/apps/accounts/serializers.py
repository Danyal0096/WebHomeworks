from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework import serializers

from .services import authenticate_by_identifier, issue_tokens, link_accounts, switch_account


User = get_user_model()


class TokenPairSerializer(serializers.Serializer):
    access = serializers.CharField()
    refresh = serializers.CharField()


class RefreshTokenResponseSerializer(serializers.Serializer):
    access = serializers.CharField()


class UserProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = ("id", "username", "email", "first_name", "last_name", "subscription_type")
        read_only_fields = ("id", "subscription_type")

    def validate_username(self, value: str | None) -> str | None:
        if not value:
            return None
        queryset = User.objects.filter(username__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("This username is already in use.")
        return value

    def validate_email(self, value: str | None) -> str | None:
        if not value:
            return None
        normalized = value.lower()
        queryset = User.objects.filter(email__iexact=normalized)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("This email is already in use.")
        return normalized

    def validate(self, attrs: dict) -> dict:
        username = attrs.get("username", self.instance.username if self.instance else None)
        email = attrs.get("email", self.instance.email if self.instance else None)
        if not username and not email:
            raise serializers.ValidationError({"non_field_errors": ["Provide at least one of username or email."]})
        return attrs


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, required=False, allow_blank=True, allow_null=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(max_length=150, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=150, required=False, allow_blank=True)

    def validate_username(self, value: str | None) -> str | None:
        if not value:
            return None
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already in use.")
        return value

    def validate_email(self, value: str | None) -> str | None:
        if not value:
            return None
        normalized = value.lower()
        if User.objects.filter(email__iexact=normalized).exists():
            raise serializers.ValidationError("This email is already in use.")
        return normalized

    def validate(self, attrs: dict) -> dict:
        if not attrs.get("username") and not attrs.get("email"):
            raise serializers.ValidationError({"non_field_errors": ["Provide at least one of username or email."]})
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError({"password_confirm": ["Passwords do not match."]})
        return attrs

    def create(self, validated_data: dict):
        validated_data.pop("password_confirm")
        password = validated_data.pop("password")
        validated_data["username"] = validated_data.get("username") or None
        validated_data["email"] = validated_data.get("email") or None
        return User.objects.create_user(password=password, **validated_data)


class AuthResponseSerializer(serializers.Serializer):
    user = UserProfileSerializer()
    tokens = TokenPairSerializer()


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, attrs: dict) -> dict:
        attrs["user"] = authenticate_by_identifier(attrs["identifier"], attrs["password"])
        return attrs


class LinkAccountSerializer(serializers.Serializer):
    identifier = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def save(self, **kwargs):
        return link_accounts(
            self.context["request"].user,
            self.validated_data["identifier"],
            self.validated_data["password"],
        )


class SwitchAccountSerializer(serializers.Serializer):
    account_id = serializers.IntegerField()

    def save(self, **kwargs):
        return switch_account(self.context["request"].user, self.validated_data["account_id"])


def auth_payload(user) -> dict:
    return {"user": UserProfileSerializer(user).data, "tokens": issue_tokens(user)}
