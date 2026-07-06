from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q
from rest_framework_simplejwt.tokens import RefreshToken

from config.exceptions import APIError, InvalidCredentials


User = get_user_model()


def issue_tokens(user) -> dict[str, str]:
    refresh = RefreshToken.for_user(user)
    return {"refresh": str(refresh), "access": str(refresh.access_token)}


def authenticate_by_identifier(identifier: str, password: str):
    user = User.objects.filter(Q(username__iexact=identifier) | Q(email__iexact=identifier)).first()
    if not user:
        raise InvalidCredentials()
    if not user.check_password(password) or not ModelBackend().user_can_authenticate(user):
        raise InvalidCredentials()
    return user


def link_accounts(current_user, identifier: str, password: str):
    target = authenticate_by_identifier(identifier, password)
    if target.pk == current_user.pk:
        raise APIError(
            "You cannot link the current account to itself.",
            code="validation_error",
            details={"identifier": ["Self-linking is not allowed."]},
        )
    current_user.linked_accounts.add(target)
    return target


def switch_account(current_user, account_id: int):
    target = current_user.linked_accounts.filter(pk=account_id).first()
    if not target:
        from rest_framework.exceptions import NotFound

        raise NotFound()
    return target
