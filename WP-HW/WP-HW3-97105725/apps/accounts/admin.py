from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    fieldsets = UserAdmin.fieldsets + (
        ("Subscription", {"fields": ("subscription_type", "linked_accounts")}),
    )
    list_display = ("username", "email", "subscription_type", "is_staff", "is_superuser")
    search_fields = ("username", "email", "first_name", "last_name")
