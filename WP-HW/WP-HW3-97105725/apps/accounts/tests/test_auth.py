import json
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken


User = get_user_model()


class AuthTests(APITestCase):
    def test_register_creates_user_returns_jwt_and_token_authenticates(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "username": "newuser",
                "email": "new@example.com",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
                "first_name": "New",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="newuser").exists())
        self.assertIn("access", response.data["tokens"])
        self.assertIn("refresh", response.data["tokens"])

        access = response.data["tokens"]["access"]
        profile = self.client.get(reverse("auth-profile"), HTTP_AUTHORIZATION=f"Bearer {access}")
        self.assertEqual(profile.status_code, status.HTTP_200_OK)
        self.assertEqual(profile.data["username"], "newuser")

    def test_register_without_email_returns_jwt_and_stores_null_email(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "username": "danyal",
                "password": "DemoPass123!",
                "password_confirm": "DemoPass123!",
                "first_name": "Dan",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(username="danyal")
        self.assertIsNone(user.email)
        self.assertIsNone(response.data["user"]["email"])
        self.assertIn("access", response.data["tokens"])

    def test_two_different_users_without_email_are_allowed(self):
        first = self.client.post(
            reverse("auth-register"),
            {"username": "noemail1", "password": "DemoPass123!", "password_confirm": "DemoPass123!"},
            format="json",
        )
        second = self.client.post(
            reverse("auth-register"),
            {"username": "noemail2", "password": "DemoPass123!", "password_confirm": "DemoPass123!"},
            format="json",
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.filter(email__isnull=True).count(), 2)

    def test_register_with_unique_email_succeeds(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "username": "emailregister",
                "email": "unique-register@example.com",
                "password": "DemoPass123!",
                "password_confirm": "DemoPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["user"]["email"], "unique-register@example.com")

    def test_register_email_only_returns_jwt_and_stores_null_username(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "email": "danyal_email_only@example.com",
                "password": "DemoPass123!",
                "password_confirm": "DemoPass123!",
                "first_name": "Dan",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email="danyal_email_only@example.com")
        self.assertIsNone(user.username)
        self.assertIsNone(response.data["user"]["username"])
        self.assertIn("access", response.data["tokens"])
        self.assertIn("refresh", response.data["tokens"])

    def test_two_distinct_email_only_users_are_allowed(self):
        first = self.client.post(
            reverse("auth-register"),
            {"email": "emailonly1@example.com", "password": "DemoPass123!", "password_confirm": "DemoPass123!"},
            format="json",
        )
        second = self.client.post(
            reverse("auth-register"),
            {"email": "emailonly2@example.com", "password": "DemoPass123!", "password_confirm": "DemoPass123!"},
            format="json",
        )

        self.assertEqual(first.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second.status_code, status.HTTP_201_CREATED)
        self.assertEqual(User.objects.filter(username__isnull=True).count(), 2)

    def test_register_without_username_or_email_returns_structured_validation_error(self):
        response = self.client.post(
            reverse("auth-register"),
            {"password": "DemoPass123!", "password_confirm": "DemoPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"]["code"], "validation_error")
        self.assertIn("non_field_errors", response.data["error"]["details"])

    def test_register_duplicate_provided_email_returns_structured_validation_error(self):
        User.objects.create_user(username="existing", email="taken-register@example.com", password="StrongPass123!")

        response = self.client.post(
            reverse("auth-register"),
            {
                "username": "newemailduplicate",
                "email": "taken-register@example.com",
                "password": "DemoPass123!",
                "password_confirm": "DemoPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"]["code"], "validation_error")
        self.assertIn("email", response.data["error"]["details"])

    def test_register_duplicate_username_returns_structured_validation_error(self):
        User.objects.create_user(username="takenusername", password="StrongPass123!")

        response = self.client.post(
            reverse("auth-register"),
            {
                "username": "takenusername",
                "password": "DemoPass123!",
                "password_confirm": "DemoPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"]["code"], "validation_error")
        self.assertIn("username", response.data["error"]["details"])

    def test_register_invalid_non_empty_email_returns_structured_validation_error(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "username": "invalidemail",
                "email": "not-an-email",
                "password": "DemoPass123!",
                "password_confirm": "DemoPass123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"]["code"], "validation_error")
        self.assertIn("email", response.data["error"]["details"])

    def test_login_accepts_username(self):
        User.objects.create_user(username="loginuser", email="login@example.com", password="StrongPass123!")

        response = self.client.post(
            reverse("auth-login"),
            {"identifier": "loginuser", "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["email"], "login@example.com")
        self.assertIn("access", response.data["tokens"])
        self.assertIn("refresh", response.data["tokens"])

    def test_username_login_accepts_account_without_email(self):
        User.objects.create_user(username="noemaillogin", password="StrongPass123!")

        response = self.client.post(
            reverse("auth-login"),
            {"identifier": "noemaillogin", "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["username"], "noemaillogin")
        self.assertIsNone(response.data["user"]["email"])

    def test_login_accepts_email(self):
        User.objects.create_user(username="emailuser", email="email-login@example.com", password="StrongPass123!")

        response = self.client.post(
            reverse("auth-login"),
            {"identifier": "email-login@example.com", "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["username"], "emailuser")
        self.assertIn("access", response.data["tokens"])
        self.assertIn("refresh", response.data["tokens"])

    def test_email_login_accepts_email_only_account(self):
        User.objects.create_user(email="email-only-login@example.com", password="StrongPass123!")

        response = self.client.post(
            reverse("auth-login"),
            {"identifier": "email-only-login@example.com", "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.data["user"]["username"])
        self.assertEqual(response.data["user"]["email"], "email-only-login@example.com")

    def test_user_with_both_identifiers_can_login_with_username_or_email(self):
        User.objects.create_user(username="bothlogin", email="both-login@example.com", password="StrongPass123!")

        username_login = self.client.post(
            reverse("auth-login"),
            {"identifier": "bothlogin", "password": "StrongPass123!"},
            format="json",
        )
        email_login = self.client.post(
            reverse("auth-login"),
            {"identifier": "both-login@example.com", "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(username_login.status_code, status.HTTP_200_OK)
        self.assertEqual(email_login.status_code, status.HTTP_200_OK)
        self.assertEqual(username_login.data["user"]["email"], "both-login@example.com")
        self.assertEqual(email_login.data["user"]["username"], "bothlogin")

    def test_access_token_lifetime_is_30_minutes(self):
        self.assertEqual(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"], timedelta(minutes=30))
        self.assertGreater(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"], settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"])

    def test_refresh_endpoint_returns_new_access_token_that_authenticates(self):
        register = self.client.post(
            reverse("auth-register"),
            {
                "username": "refreshuser",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
            },
            format="json",
        )
        self.assertEqual(register.status_code, status.HTTP_201_CREATED)
        refresh_token = register.data["tokens"]["refresh"]

        refresh = self.client.post(reverse("auth-token-refresh"), {"refresh": refresh_token}, format="json")

        self.assertEqual(refresh.status_code, status.HTTP_200_OK)
        self.assertIn("access", refresh.data)
        self.assertNotIn("refresh", refresh.data)
        profile = self.client.get(reverse("auth-profile"), HTTP_AUTHORIZATION=f"Bearer {refresh.data['access']}")
        self.assertEqual(profile.status_code, status.HTTP_200_OK)
        self.assertEqual(profile.data["username"], "refreshuser")

    def test_refresh_endpoint_works_after_email_only_registration(self):
        register = self.client.post(
            reverse("auth-register"),
            {
                "email": "refresh-email-only@example.com",
                "password": "StrongPass123!",
                "password_confirm": "StrongPass123!",
            },
            format="json",
        )
        self.assertEqual(register.status_code, status.HTTP_201_CREATED)

        refresh = self.client.post(
            reverse("auth-token-refresh"),
            {"refresh": register.data["tokens"]["refresh"]},
            format="json",
        )
        profile = self.client.get(reverse("auth-profile"), HTTP_AUTHORIZATION=f"Bearer {refresh.data['access']}")

        self.assertEqual(refresh.status_code, status.HTTP_200_OK)
        self.assertEqual(profile.status_code, status.HTTP_200_OK)
        self.assertEqual(profile.data["email"], "refresh-email-only@example.com")
        self.assertIsNone(profile.data["username"])

    def test_refresh_endpoint_malformed_token_returns_structured_error(self):
        response = self.client.post(reverse("auth-token-refresh"), {"refresh": "not-a-jwt"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["error"]["code"], "authentication_failed")
        self.assertIn("request_id", response.data)

    def test_refresh_endpoint_expired_token_returns_structured_error(self):
        user = User.objects.create_user(username="expiredrefresh", password="StrongPass123!")
        refresh_token = RefreshToken.for_user(user)
        refresh_token.set_exp(lifetime=timedelta(seconds=-1))

        response = self.client.post(reverse("auth-token-refresh"), {"refresh": str(refresh_token)}, format="json")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["error"]["code"], "authentication_failed")
        self.assertIn("request_id", response.data)

    def test_refresh_endpoint_missing_token_returns_structured_validation_error(self):
        response = self.client.post(reverse("auth-token-refresh"), {}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"]["code"], "validation_error")
        self.assertIn("refresh", response.data["error"]["details"])

    def test_swagger_schema_includes_refresh_endpoint_and_examples(self):
        response = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json")
        schema = json.loads(response.content)
        operation = schema["paths"]["/api/auth/token/refresh/"]["post"]
        request_examples = operation["requestBody"]["content"]["application/json"]["examples"]
        response_examples = operation["responses"]["200"]["content"]["application/json"]["examples"]

        self.assertIn("RefreshAccessToken", request_examples)
        self.assertIn("NewAccessToken", response_examples)
        self.assertEqual(operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"], "#/components/schemas/RefreshTokenResponse")

    def test_swagger_schema_documents_registration_identity_alternatives(self):
        response = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json")
        schema = json.loads(response.content)
        operation = schema["paths"]["/api/auth/register/"]["post"]
        examples = operation["requestBody"]["content"]["application/json"]["examples"]
        example_values = [example["value"] for example in examples.values()]
        register_schema_ref = operation["requestBody"]["content"]["application/json"]["schema"]["$ref"].split("/")[-1]
        required_fields = set(schema["components"]["schemas"][register_schema_ref].get("required", []))

        self.assertIn("password", required_fields)
        self.assertIn("password_confirm", required_fields)
        self.assertNotIn("username", required_fields)
        self.assertNotIn("email", required_fields)
        self.assertTrue(any("username" in value and "email" not in value for value in example_values))
        self.assertTrue(any("email" in value and "username" not in value for value in example_values))
        self.assertTrue(any("username" in value and "email" in value for value in example_values))
        response_examples = operation["responses"]["400"]["content"]["application/json"]["examples"]
        self.assertTrue(
            any(
                example["summary"] == "missing_username_and_email"
                and "non_field_errors" in example["value"]["error"]["details"]
                for example in response_examples.values()
            )
        )

    def test_invalid_login_returns_structured_invalid_credentials_error(self):
        User.objects.create_user(username="badlogin", email="badlogin@example.com", password="StrongPass123!")

        response = self.client.post(
            reverse("auth-login"),
            {"identifier": "badlogin", "password": "WrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data["error"]["code"], "invalid_credentials")
        self.assertIn("request_id", response.data)

    def test_profile_retrieve_patch_safe_fields_only(self):
        user = User.objects.create_user(username="profile", email="profile@example.com", password="StrongPass123!")
        self.client.force_authenticate(user)

        get_response = self.client.get(reverse("auth-profile"))
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["subscription_type"], "FREE")

        patch_response = self.client.patch(
            reverse("auth-profile"),
            {
                "first_name": "Patched",
                "email": "patched@example.com",
                "subscription_type": "PREMIUM",
                "is_superuser": True,
            },
            format="json",
        )

        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.first_name, "Patched")
        self.assertEqual(user.email, "patched@example.com")
        self.assertEqual(user.subscription_type, "FREE")
        self.assertFalse(user.is_superuser)

    def test_profile_patch_duplicate_email_returns_validation_error(self):
        user = User.objects.create_user(username="profile2", email="profile2@example.com", password="StrongPass123!")
        User.objects.create_user(username="taken", email="taken@example.com", password="StrongPass123!")
        self.client.force_authenticate(user)

        response = self.client.patch(reverse("auth-profile"), {"email": "taken@example.com"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"]["code"], "validation_error")
        self.assertIn("email", response.data["error"]["details"])

    def test_profile_patch_duplicate_username_returns_validation_error(self):
        user = User.objects.create_user(username="profile3", email="profile3@example.com", password="StrongPass123!")
        User.objects.create_user(username="takenname", email="takenname@example.com", password="StrongPass123!")
        self.client.force_authenticate(user)

        response = self.client.patch(reverse("auth-profile"), {"username": "takenname"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"]["code"], "validation_error")
        self.assertIn("username", response.data["error"]["details"])

    def test_account_linking_creates_two_way_relation(self):
        user = User.objects.create_user(username="primary", email="primary@example.com", password="StrongPass123!")
        other = User.objects.create_user(username="linked", email="linked@example.com", password="StrongPass123!")
        self.client.force_authenticate(user)

        response = self.client.post(
            reverse("auth-link-account"),
            {"identifier": "linked@example.com", "password": "StrongPass123!"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(user.linked_accounts.filter(pk=other.pk).exists())
        self.assertTrue(other.linked_accounts.filter(pk=user.pk).exists())

    def test_account_linking_and_switching_support_email_only_target(self):
        user = User.objects.create_user(username="primary-email-link", password="StrongPass123!")
        target = User.objects.create_user(email="target-email-only@example.com", password="StrongPass123!")
        self.client.force_authenticate(user)

        link = self.client.post(
            reverse("auth-link-account"),
            {"identifier": "target-email-only@example.com", "password": "StrongPass123!"},
            format="json",
        )
        switch = self.client.post(reverse("auth-switch"), {"account_id": target.pk}, format="json")

        self.assertEqual(link.status_code, status.HTTP_200_OK)
        self.assertIsNone(link.data["username"])
        self.assertEqual(link.data["email"], "target-email-only@example.com")
        self.assertEqual(switch.status_code, status.HTTP_200_OK)
        self.assertIsNone(switch.data["user"]["username"])
        self.assertEqual(switch.data["user"]["email"], "target-email-only@example.com")

    def test_account_switch_returns_tokens_for_linked_and_rejects_unlinked(self):
        user = User.objects.create_user(username="switcher", email="switcher@example.com", password="StrongPass123!")
        linked = User.objects.create_user(username="target", email="target@example.com", password="StrongPass123!")
        unlinked = User.objects.create_user(username="unlinked", email="unlinked@example.com", password="StrongPass123!")
        user.linked_accounts.add(linked)
        self.client.force_authenticate(user)

        response = self.client.post(reverse("auth-switch"), {"account_id": linked.pk}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["user"]["username"], "target")
        self.assertIn("access", response.data["tokens"])

        rejected = self.client.post(reverse("auth-switch"), {"account_id": unlinked.pk}, format="json")
        self.assertEqual(rejected.status_code, status.HTTP_404_NOT_FOUND)
