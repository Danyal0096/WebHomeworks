import json
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.chat.models import AIModel, Assistant, Conversation, Project


User = get_user_model()


class CoreTests(APITestCase):
    def test_health_returns_expected_body_and_request_id_header(self):
        response = self.client.get(reverse("health"), HTTP_X_REQUEST_ID="test-request-123")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {"status": "ok", "database": "reachable", "version": "1.0.0"})
        self.assertEqual(response["X-Request-ID"], "test-request-123")

    def test_validation_error_uses_structured_envelope(self):
        response = self.client.post(
            reverse("auth-register"),
            {
                "username": "bad",
                "email": "bad@example.com",
                "password": "StrongPass123!",
                "password_confirm": "Mismatch123!",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"]["code"], "validation_error")
        self.assertIn("request_id", response.data)

    def test_schema_and_swagger_endpoints_load(self):
        schema = self.client.get(reverse("schema"))
        docs = self.client.get(reverse("swagger-ui"))

        self.assertEqual(schema.status_code, status.HTTP_200_OK)
        self.assertEqual(docs.status_code, status.HTTP_200_OK)

    def test_swagger_schema_security_schemes_are_valid_and_examples_are_complete(self):
        response = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json")
        schema = json.loads(response.content)
        security_schemes = set(schema["components"]["securitySchemes"].keys())
        self.assertIn("jwtAuth", security_schemes)
        self.assertNotIn("bearerAuth", security_schemes)

        body_operations_without_standard_examples = []
        delete_responses_with_204_body = []
        undefined_security_references = []
        for path, operations in schema["paths"].items():
            for method, operation in operations.items():
                if method not in {"get", "post", "patch", "delete"}:
                    continue
                for security_option in operation.get("security", []):
                    for scheme_name in security_option.keys():
                        if scheme_name not in security_schemes:
                            undefined_security_references.append(f"{method.upper()} {path}: {scheme_name}")

                for media_type, media in operation.get("requestBody", {}).get("content", {}).items():
                    if media_type == "application/json" and "examples" not in media and "example" not in media:
                        body_operations_without_standard_examples.append(f"{method.upper()} {path} request")
                for status_code, response_data in operation.get("responses", {}).items():
                    for media_type, media in response_data.get("content", {}).items():
                        if (
                            status_code != "204"
                            and media_type == "application/json"
                            and "examples" not in media
                            and "example" not in media
                        ):
                            body_operations_without_standard_examples.append(
                                f"{method.upper()} {path} {status_code} response"
                            )
                if method == "delete" and operation.get("responses", {}).get("204", {}).get("content"):
                    delete_responses_with_204_body.append(f"{method.upper()} {path}")

        self.assertEqual(undefined_security_references, [])
        self.assertEqual(body_operations_without_standard_examples, [])
        self.assertEqual(delete_responses_with_204_body, [])

    def test_swagger_paginated_examples_are_not_double_wrapped(self):
        response = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json")
        schema = json.loads(response.content)
        affected_paths = [
            "/api/models/",
            "/api/assistants/",
            "/api/projects/",
            "/api/projects/{id}/conversations/",
            "/api/conversations/",
            "/api/conversations/{id}/messages/",
            "/api/messages/{id}/attachments/",
        ]
        pagination_keys = {"count", "next", "previous", "results"}

        for path in affected_paths:
            with self.subTest(path=path):
                examples = (
                    schema["paths"][path]["get"]["responses"]["200"]["content"]["application/json"].get("examples") or {}
                )
                self.assertTrue(examples)
                for example_payload in examples.values():
                    value = example_payload["value"]
                    self.assertTrue(pagination_keys.issubset(value.keys()))
                    self.assertIsInstance(value["results"], list)
                    self.assertGreater(len(value["results"]), 0)
                    first_result = value["results"][0]
                    self.assertIsInstance(first_result, dict)
                    self.assertFalse(pagination_keys.issubset(first_result.keys()))

    def test_seed_demo_is_idempotent(self):
        out = StringIO()
        call_command("seed_demo", stdout=out)
        call_command("seed_demo", stdout=out)

        self.assertEqual(AIModel.objects.filter(name__in=["GPT-3.5 Turbo", "GPT-4", "Claude 3"]).count(), 3)
        self.assertEqual(
            Assistant.objects.filter(title__in=["General Assistant", "Translator", "Coding Assistant"], is_public=True).count(),
            3,
        )
        self.assertEqual(User.objects.filter(username__in=["admin_demo", "free_demo", "premium_demo"]).count(), 3)
        free = User.objects.get(username="free_demo")
        self.assertEqual(Project.objects.filter(owner=free, title="Demo Project").count(), 1)
        self.assertEqual(Conversation.objects.filter(owner=free, title="Demo Conversation").count(), 1)
