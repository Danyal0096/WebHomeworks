from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import AbstractUser, UserManager as DjangoUserManager
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.apps import apps
from django.db import models


class UserManager(DjangoUserManager):
    @classmethod
    def normalize_email(cls, email):
        normalized = super().normalize_email(email)
        return normalized or None

    @staticmethod
    def normalize_optional_username(username):
        return username or None

    def _create_user_object(self, username, email, password, **extra_fields):
        username = self.normalize_optional_username(username)
        email = self.normalize_email(email)
        if not username and not email:
            raise ValueError("Either username or email must be set")
        GlobalUserModel = apps.get_model(
            self.model._meta.app_label,
            self.model._meta.object_name,
        )
        username = GlobalUserModel.normalize_username(username) if username else None
        user = self.model(username=username, email=email, **extra_fields)
        user.password = make_password(password)
        return user

    def create_user(self, username=None, email=None, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, email, password, **extra_fields)

    def create_superuser(self, username, email=None, password=None, **extra_fields):
        if not username:
            raise ValueError("Superuser must have a username.")
        return super().create_superuser(username, email, password, **extra_fields)


class User(AbstractUser):
    username_validator = UnicodeUsernameValidator()

    class SubscriptionType(models.TextChoices):
        FREE = "FREE", "Free"
        PREMIUM = "PREMIUM", "Premium"

    username = models.CharField(
        max_length=150,
        unique=True,
        blank=True,
        null=True,
        validators=[username_validator],
        error_messages={"unique": "A user with that username already exists."},
    )
    email = models.EmailField(unique=True, blank=True, null=True)
    subscription_type = models.CharField(
        max_length=20,
        choices=SubscriptionType.choices,
        default=SubscriptionType.FREE,
    )
    linked_accounts = models.ManyToManyField(
        "self",
        symmetrical=True,
        blank=True,
    )
    objects = UserManager()

    REQUIRED_FIELDS = []

    def __str__(self) -> str:
        return self.username
