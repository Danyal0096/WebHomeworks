from django.urls import path

from .views import (
    DocumentedTokenRefreshView,
    LinkedAccountsView,
    LinkAccountView,
    LoginView,
    ProfileView,
    RegisterView,
    SwitchAccountView,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("login/", LoginView.as_view(), name="auth-login"),
    path("token/refresh/", DocumentedTokenRefreshView.as_view(), name="auth-token-refresh"),
    path("profile/", ProfileView.as_view(), name="auth-profile"),
    path("link-account/", LinkAccountView.as_view(), name="auth-link-account"),
    path("linked-accounts/", LinkedAccountsView.as_view(), name="auth-linked-accounts"),
    path("switch/", SwitchAccountView.as_view(), name="auth-switch"),
]
