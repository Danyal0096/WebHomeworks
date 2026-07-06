import json
import os
import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.test import override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from django.core.files.uploadedfile import SimpleUploadedFile

from apps.chat.models import AIModel, Assistant, Attachment, Conversation, Message, Project


User = get_user_model()


class ChatAPITestCase(APITestCase):
    def setUp(self):
        self.temp_media = tempfile.mkdtemp()
        self.media_override = override_settings(MEDIA_ROOT=self.temp_media)
        self.media_override.enable()
        self.addCleanup(self.media_override.disable)
        self.addCleanup(shutil.rmtree, self.temp_media, ignore_errors=True)

        self.user = User.objects.create_user(username="owner", email="owner@example.com", password="StrongPass123!")
        self.other = User.objects.create_user(username="other", email="other@example.com", password="StrongPass123!")
        self.premium = User.objects.create_user(
            username="premium",
            email="premium@example.com",
            password="StrongPass123!",
            subscription_type=User.SubscriptionType.PREMIUM,
        )
        self.admin = User.objects.create_superuser(username="admin", email="admin@example.com", password="StrongPass123!")
        self.free_model = AIModel.objects.create(name="GPT-3.5 Turbo", provider="OpenAI", minimum_subscription="FREE")
        self.premium_model = AIModel.objects.create(name="GPT-4", provider="OpenAI", minimum_subscription="PREMIUM")
        self.public_assistant = Assistant.objects.create(
            title="General Assistant",
            description="General help.",
            system_prompt="Be helpful.",
            is_public=True,
            owner=None,
        )
        self.private_assistant = Assistant.objects.create(
            title="Private Coach",
            description="Private help.",
            system_prompt="Be specific.",
            is_public=False,
            owner=self.user,
        )

    def auth(self, user):
        self.client.force_authenticate(user)

    def conversation(self, user=None, **kwargs):
        owner = user or self.user
        return Conversation.objects.create(
            owner=owner,
            ai_model=kwargs.pop("ai_model", self.free_model),
            title=kwargs.pop("title", "Test conversation"),
            **kwargs,
        )

    def assert_paginated_response(self, response):
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, dict)
        self.assertIn("count", response.data)
        self.assertIn("next", response.data)
        self.assertIn("previous", response.data)
        self.assertIn("results", response.data)

    def test_cross_user_project_retrieve_update_delete_returns_404(self):
        project = Project.objects.create(owner=self.other, title="Other project")
        self.auth(self.user)
        detail = reverse("project-detail", args=[project.pk])

        self.assertEqual(self.client.get(detail).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.patch(detail, {"title": "Hack"}, format="json").status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.delete(detail).status_code, status.HTTP_404_NOT_FOUND)
        project.refresh_from_db()
        self.assertEqual(project.title, "Other project")

    def test_cross_user_conversation_and_message_access_returns_404(self):
        conversation = self.conversation(self.other)
        message = Message.objects.create(conversation=conversation, role=Message.Role.USER, content="secret")
        self.auth(self.user)

        self.assertEqual(self.client.get(reverse("conversation-detail", args=[conversation.pk])).status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(self.client.patch(reverse("message-detail", args=[message.pk]), {"content": "x"}, format="json").status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_owner_project_id_on_conversation_create_and_update_returns_404(self):
        other_project = Project.objects.create(owner=self.other, title="Other project")
        conversation = self.conversation()
        self.auth(self.user)

        create = self.client.post(
            reverse("conversation-list"),
            {"title": "Leak check", "ai_model_id": self.free_model.pk, "project_id": other_project.pk},
            format="json",
        )
        update = self.client.patch(
            reverse("conversation-detail", args=[conversation.pk]),
            {"project_id": other_project.pk},
            format="json",
        )

        self.assertEqual(create.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(update.status_code, status.HTTP_404_NOT_FOUND)

    def test_normal_user_cannot_create_update_delete_ai_models(self):
        self.auth(self.user)
        create = self.client.post(
            reverse("model-list"),
            {"name": "Forbidden", "provider": "OpenAI", "minimum_subscription": "FREE", "is_active": True},
            format="json",
        )
        patch = self.client.patch(reverse("model-detail", args=[self.free_model.pk]), {"name": "Changed"}, format="json")
        delete = self.client.delete(reverse("model-detail", args=[self.free_model.pk]))

        self.assertEqual(create.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(patch.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(delete.status_code, status.HTTP_403_FORBIDDEN)

    def test_superuser_can_create_and_update_ai_models(self):
        self.auth(self.admin)
        create = self.client.post(
            reverse("model-list"),
            {"name": "Claude 3", "provider": "Anthropic", "minimum_subscription": "PREMIUM", "is_active": True},
            format="json",
        )
        self.assertEqual(create.status_code, status.HTTP_201_CREATED)

        patch = self.client.patch(reverse("model-detail", args=[create.data["id"]]), {"is_active": False}, format="json")
        self.assertEqual(patch.status_code, status.HTTP_200_OK)
        self.assertFalse(AIModel.objects.get(pk=create.data["id"]).is_active)

    def test_superuser_delete_referenced_ai_model_returns_model_in_use_conflict(self):
        conversation = self.conversation()
        self.auth(self.admin)

        response = self.client.delete(reverse("model-detail", args=[conversation.ai_model_id]))

        self.assertEqual(response.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(response.data["error"]["code"], "model_in_use")
        self.assertTrue(AIModel.objects.filter(pk=conversation.ai_model_id).exists())

    def test_superuser_delete_unreferenced_ai_model_succeeds(self):
        unused = AIModel.objects.create(name="Unused Model", provider="OpenAI", minimum_subscription="FREE")
        self.auth(self.admin)

        response = self.client.delete(reverse("model-detail", args=[unused.pk]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(AIModel.objects.filter(pk=unused.pk).exists())

    def test_private_assistant_visible_only_to_owner_public_visible_to_authenticated_users(self):
        other_private = Assistant.objects.create(
            title="Other Private",
            description="Hidden",
            system_prompt="Hidden",
            is_public=False,
            owner=self.other,
        )
        self.auth(self.user)
        owner_response = self.client.get(reverse("assistant-list"))
        owner_titles = {item["title"] for item in owner_response.data["results"]}
        self.assertIn("General Assistant", owner_titles)
        self.assertIn("Private Coach", owner_titles)
        self.assertNotIn("Other Private", owner_titles)

        self.auth(self.other)
        other_response = self.client.get(reverse("assistant-list"))
        other_titles = {item["title"] for item in other_response.data["results"]}
        self.assertIn("General Assistant", other_titles)
        self.assertIn("Other Private", other_titles)
        self.assertNotIn("Private Coach", other_titles)

        immutable = self.client.patch(
            reverse("assistant-detail", args=[self.public_assistant.pk]),
            {"title": "Changed"},
            format="json",
        )
        self.assertEqual(immutable.status_code, status.HTTP_403_FORBIDDEN)

    def test_superuser_cannot_patch_another_users_private_assistant(self):
        other_private = Assistant.objects.create(
            title="Other Private",
            description="Hidden",
            system_prompt="Hidden",
            is_public=False,
            owner=self.other,
        )
        self.auth(self.admin)

        response = self.client.patch(
            reverse("assistant-detail", args=[other_private.pk]),
            {"description": "Admin edit"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        other_private.refresh_from_db()
        self.assertEqual(other_private.owner, self.other)
        self.assertEqual(other_private.description, "Hidden")

    def test_normal_user_cannot_delete_public_assistant(self):
        self.auth(self.user)

        response = self.client.delete(reverse("assistant-detail", args=[self.public_assistant.pk]))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Assistant.objects.filter(pk=self.public_assistant.pk).exists())

    def test_superuser_updating_public_assistant_does_not_alter_owner(self):
        self.auth(self.admin)

        response = self.client.patch(
            reverse("assistant-detail", args=[self.public_assistant.pk]),
            {"description": "Updated public assistant."},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.public_assistant.refresh_from_db()
        self.assertIsNone(self.public_assistant.owner)
        self.assertTrue(self.public_assistant.is_public)
        self.assertEqual(self.public_assistant.description, "Updated public assistant.")

    def test_free_user_cannot_select_premium_model(self):
        self.auth(self.user)
        response = self.client.post(
            reverse("conversation-list"),
            {"title": "Premium attempt", "ai_model_id": self.premium_model.pk},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["error"]["code"], "model_not_available")

    def test_inaccessible_private_assistant_cannot_be_selected(self):
        other_private = Assistant.objects.create(
            title="Other Private",
            description="Hidden",
            system_prompt="Hidden",
            is_public=False,
            owner=self.other,
        )
        self.auth(self.user)

        response = self.client.post(
            reverse("conversation-list"),
            {"title": "Assistant attempt", "ai_model_id": self.free_model.pk, "assistant_id": other_private.pk},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["error"]["code"], "not_found")

    def test_superuser_cannot_create_conversation_with_another_users_private_assistant(self):
        other_private = Assistant.objects.create(
            title="Other Private",
            description="Hidden",
            system_prompt="Do not leak.",
            is_public=False,
            owner=self.other,
        )
        self.auth(self.admin)

        response = self.client.post(
            reverse("conversation-list"),
            {"title": "Leak attempt", "ai_model_id": self.free_model.pk, "assistant_id": other_private.pk},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["error"]["code"], "not_found")
        self.assertEqual(self.admin.conversations.count(), 0)

    def test_superuser_cannot_patch_conversation_to_another_users_private_assistant(self):
        other_private = Assistant.objects.create(
            title="Other Private",
            description="Hidden",
            system_prompt="Do not leak.",
            is_public=False,
            owner=self.other,
        )
        conversation = self.conversation(self.admin, assistant=self.public_assistant)
        self.auth(self.admin)

        response = self.client.patch(
            reverse("conversation-detail", args=[conversation.pk]),
            {"assistant_id": other_private.pk},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["error"]["code"], "not_found")
        conversation.refresh_from_db()
        self.assertEqual(conversation.assistant, self.public_assistant)

    def test_owner_can_select_private_assistant_and_any_user_can_select_public_assistant(self):
        self.auth(self.user)
        private_response = self.client.post(
            reverse("conversation-list"),
            {"title": "Private allowed", "ai_model_id": self.free_model.pk, "assistant_id": self.private_assistant.pk},
            format="json",
        )

        self.assertEqual(private_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(private_response.data["assistant"]["id"], self.private_assistant.pk)

        self.auth(self.other)
        public_response = self.client.post(
            reverse("conversation-list"),
            {"title": "Public allowed", "ai_model_id": self.free_model.pk, "assistant_id": self.public_assistant.pk},
            format="json",
        )

        self.assertEqual(public_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(public_response.data["assistant"]["id"], self.public_assistant.pk)

    def test_message_send_creates_user_and_assistant_messages_and_updates_activity(self):
        conversation = self.conversation(assistant=self.public_assistant)
        self.auth(self.user)

        response = self.client.post(
            reverse("conversation-messages", args=[conversation.pk]),
            {"content": "Hello"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(conversation.messages.count(), 2)
        roles = list(conversation.messages.values_list("role", flat=True))
        self.assertEqual(roles, [Message.Role.USER, Message.Role.ASSISTANT])
        self.assertIn("GPT-3.5 Turbo", response.data["assistant_message"]["content"])
        conversation.refresh_from_db()
        self.assertIsNotNone(conversation.last_message_at)

    def test_free_user_quota_allows_first_50_and_blocks_51st(self):
        conversation = self.conversation()
        self.auth(self.user)

        for index in range(50):
            response = self.client.post(
                reverse("conversation-messages", args=[conversation.pk]),
                {"content": f"Message {index}"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        blocked = self.client.post(
            reverse("conversation-messages", args=[conversation.pk]),
            {"content": "Message 51"},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertEqual(blocked.data["error"]["code"], "quota_exceeded")
        self.assertEqual(blocked.data["error"]["details"]["limit"], 50)

    def test_premium_user_bypasses_quota(self):
        conversation = self.conversation(self.premium)
        Message.objects.bulk_create(
            [Message(conversation=conversation, role=Message.Role.USER, content=f"old {i}") for i in range(55)]
        )
        self.auth(self.premium)

        response = self.client.post(
            reverse("conversation-messages", args=[conversation.pk]),
            {"content": "Still allowed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_deleted_conversation_cannot_receive_messages_restore_permits_it(self):
        conversation = self.conversation()
        self.auth(self.user)

        delete = self.client.delete(reverse("conversation-detail", args=[conversation.pk]))
        self.assertEqual(delete.status_code, status.HTTP_204_NO_CONTENT)
        blocked = self.client.post(
            reverse("conversation-messages", args=[conversation.pk]),
            {"content": "Nope"},
            format="json",
        )
        self.assertEqual(blocked.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(blocked.data["error"]["code"], "conversation_deleted")

        archive_deleted = self.client.post(reverse("conversation-archive", args=[conversation.pk]))
        self.assertEqual(archive_deleted.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(archive_deleted.data["error"]["code"], "conversation_deleted")

        edit_deleted = self.client.patch(
            reverse("conversation-detail", args=[conversation.pk]),
            {"title": "Should not edit"},
            format="json",
        )
        self.assertEqual(edit_deleted.status_code, status.HTTP_409_CONFLICT)
        self.assertEqual(edit_deleted.data["error"]["code"], "conversation_deleted")

        restore = self.client.post(reverse("conversation-restore", args=[conversation.pk]))
        self.assertEqual(restore.status_code, status.HTTP_200_OK)
        allowed = self.client.post(
            reverse("conversation-messages", args=[conversation.pk]),
            {"content": "Back"},
            format="json",
        )
        self.assertEqual(allowed.status_code, status.HTTP_201_CREATED)

    def test_user_can_edit_delete_only_user_role_messages(self):
        conversation = self.conversation()
        user_message = Message.objects.create(conversation=conversation, role=Message.Role.USER, content="old")
        assistant_message = Message.objects.create(conversation=conversation, role=Message.Role.ASSISTANT, content="reply")
        self.auth(self.user)

        edit = self.client.patch(reverse("message-detail", args=[user_message.pk]), {"content": "new"}, format="json")
        self.assertEqual(edit.status_code, status.HTTP_200_OK)
        user_message.refresh_from_db()
        self.assertEqual(user_message.content, "new")

        blocked_edit = self.client.patch(reverse("message-detail", args=[assistant_message.pk]), {"content": "x"}, format="json")
        blocked_delete = self.client.delete(reverse("message-detail", args=[assistant_message.pk]))
        self.assertEqual(blocked_edit.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(blocked_delete.status_code, status.HTTP_403_FORBIDDEN)

        delete = self.client.delete(reverse("message-detail", args=[user_message.pk]))
        self.assertEqual(delete.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Message.objects.filter(pk=user_message.pk).exists())

    def test_free_attachment_upload_blocked_and_premium_upload_succeeds(self):
        free_conversation = self.conversation()
        self.auth(self.user)
        free_upload = SimpleUploadedFile("free.txt", b"hello", content_type="text/plain")
        blocked = self.client.post(
            reverse("conversation-messages", args=[free_conversation.pk]),
            {"content": "with file", "file": free_upload},
            format="multipart",
        )
        self.assertEqual(blocked.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(blocked.data["error"]["code"], "premium_required")

        premium_conversation = self.conversation(self.premium)
        self.auth(self.premium)
        premium_upload = SimpleUploadedFile("premium.txt", b"hello", content_type="text/plain")
        allowed = self.client.post(
            reverse("conversation-messages", args=[premium_conversation.pk]),
            {"content": "with file", "file": premium_upload},
            format="multipart",
        )
        self.assertEqual(allowed.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Attachment.objects.count(), 1)

    def test_repeated_multipart_files_upload_creates_all_attachments(self):
        conversation = self.conversation(self.premium)
        self.auth(self.premium)
        first = SimpleUploadedFile("first.txt", b"first", content_type="text/plain")
        second = SimpleUploadedFile("second.txt", b"second", content_type="text/plain")

        response = self.client.post(
            reverse("conversation-messages", args=[conversation.pk]),
            {"content": "multiple files", "files": [first, second]},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user_message = Message.objects.get(pk=response.data["user_message"]["id"])
        self.assertEqual(user_message.attachments.count(), 2)
        self.assertEqual(set(user_message.attachments.values_list("original_name", flat=True)), {"first.txt", "second.txt"})

    def test_oversized_attachment_upload_is_rejected(self):
        conversation = self.conversation(self.premium)
        self.auth(self.premium)
        oversized = SimpleUploadedFile(
            "too-large.txt",
            b"x" * (10 * 1024 * 1024 + 1),
            content_type="text/plain",
        )

        response = self.client.post(
            reverse("conversation-messages", args=[conversation.pk]),
            {"content": "large file", "file": oversized},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["error"]["code"], "validation_error")
        self.assertFalse(Attachment.objects.exists())

    def test_malformed_relationship_ids_return_structured_4xx(self):
        conversation = self.conversation()
        self.auth(self.user)

        cases = [
            ("create_bad_project", reverse("conversation-list"), {"title": "bad", "ai_model_id": self.free_model.pk, "project_id": "abc"}, "post"),
            ("create_bad_assistant", reverse("conversation-list"), {"title": "bad", "ai_model_id": self.free_model.pk, "assistant_id": "abc"}, "post"),
            ("create_bad_model", reverse("conversation-list"), {"title": "bad", "ai_model_id": "abc"}, "post"),
            ("update_bad_project", reverse("conversation-detail", args=[conversation.pk]), {"project_id": "abc"}, "patch"),
            ("update_bad_assistant", reverse("conversation-detail", args=[conversation.pk]), {"assistant_id": "abc"}, "patch"),
            ("update_bad_model", reverse("conversation-detail", args=[conversation.pk]), {"ai_model_id": "abc"}, "patch"),
        ]
        for label, url, payload, method in cases:
            with self.subTest(label=label):
                response = getattr(self.client, method)(url, payload, format="json")
                self.assertIn(response.status_code, {status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND})
                self.assertIn(response.data["error"]["code"], {"validation_error", "not_found"})

    def test_attachment_access_hidden_from_other_users_and_download_works_for_owner(self):
        conversation = self.conversation(self.premium)
        message = Message.objects.create(conversation=conversation, role=Message.Role.USER, content="file")
        attachment = Attachment.objects.create(
            message=message,
            file=SimpleUploadedFile("owner.txt", b"secret", content_type="text/plain"),
            original_name="owner.txt",
            content_type="text/plain",
            size_bytes=6,
        )

        self.auth(self.other)
        hidden_list = self.client.get(reverse("message-attachments", args=[message.pk]))
        hidden_download = self.client.get(reverse("attachment-download", args=[attachment.pk]))
        self.assertEqual(hidden_list.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(hidden_download.status_code, status.HTTP_404_NOT_FOUND)

        self.auth(self.premium)
        owner_list = self.client.get(reverse("message-attachments", args=[message.pk]))
        owner_download = self.client.get(reverse("attachment-download", args=[attachment.pk]))
        self.assertEqual(owner_list.status_code, status.HTTP_200_OK)
        self.assertEqual(owner_list.data["count"], 1)
        self.assertEqual(owner_list.data["results"][0]["original_name"], "owner.txt")
        self.assertEqual(owner_download.status_code, status.HTTP_200_OK)

    def test_attachment_download_accept_headers_return_file_stream(self):
        conversation = self.conversation(self.premium)
        message = Message.objects.create(conversation=conversation, role=Message.Role.USER, content="file")
        attachment = Attachment.objects.create(
            message=message,
            file=SimpleUploadedFile("accept.txt", b"accept-bytes", content_type="text/plain"),
            original_name="accept.txt",
            content_type="text/plain",
            size_bytes=12,
        )
        self.auth(self.premium)
        url = reverse("attachment-download", args=[attachment.pk])

        for accept in ("*/*", "application/octet-stream", "application/json"):
            with self.subTest(accept=accept):
                response = self.client.get(url, HTTP_ACCEPT=accept)
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(b"".join(response.streaming_content), b"accept-bytes")
                self.assertIn('attachment; filename="accept.txt"', response["Content-Disposition"])

    def test_attachment_download_cross_owner_remains_structured_404_with_binary_accept(self):
        conversation = self.conversation(self.premium)
        message = Message.objects.create(conversation=conversation, role=Message.Role.USER, content="file")
        attachment = Attachment.objects.create(
            message=message,
            file=SimpleUploadedFile("hidden.txt", b"hidden", content_type="text/plain"),
            original_name="hidden.txt",
            content_type="text/plain",
            size_bytes=6,
        )
        self.auth(self.other)

        response = self.client.get(reverse("attachment-download", args=[attachment.pk]), HTTP_ACCEPT="application/octet-stream")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertEqual(response.data["error"]["code"], "not_found")

    def test_missing_physical_attachment_file_returns_controlled_410(self):
        conversation = self.conversation(self.premium)
        message = Message.objects.create(conversation=conversation, role=Message.Role.USER, content="file")
        attachment = Attachment.objects.create(
            message=message,
            file=SimpleUploadedFile("missing.txt", b"missing", content_type="text/plain"),
            original_name="missing.txt",
            content_type="text/plain",
            size_bytes=7,
        )
        os.remove(attachment.file.path)
        self.auth(self.premium)

        response = self.client.get(reverse("attachment-download", args=[attachment.pk]), HTTP_ACCEPT="application/octet-stream")

        self.assertEqual(response.status_code, status.HTTP_410_GONE)
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertEqual(response.data["error"]["code"], "attachment_file_missing")
        self.assertEqual(response.data["error"]["details"]["attachment_id"], attachment.pk)

    def test_custom_list_actions_are_paginated_and_match_schema(self):
        project = Project.objects.create(owner=self.premium, title="Custom Lists")
        conversation = self.conversation(self.premium, project=project)
        message = Message.objects.create(conversation=conversation, role=Message.Role.USER, content="file")
        Attachment.objects.create(
            message=message,
            file=SimpleUploadedFile("custom.txt", b"secret", content_type="text/plain"),
            original_name="custom.txt",
            content_type="text/plain",
            size_bytes=6,
        )
        self.auth(self.premium)

        cases = [
            (reverse("project-conversations", args=[project.pk]), "/api/projects/{id}/conversations/"),
            (reverse("conversation-messages", args=[conversation.pk]), "/api/conversations/{id}/messages/"),
            (reverse("message-attachments", args=[message.pk]), "/api/messages/{id}/attachments/"),
        ]
        schema_response = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json")
        schema = json.loads(schema_response.content)

        for url, schema_path in cases:
            with self.subTest(schema_path=schema_path):
                response = self.client.get(url)
                self.assert_paginated_response(response)
                schema_ref = schema["paths"][schema_path]["get"]["responses"]["200"]["content"]["application/json"]["schema"]["$ref"]
                self.assertIn("Paginated", schema_ref)

    def test_project_delete_cascades_conversations_messages_attachments_and_physical_file(self):
        project = Project.objects.create(owner=self.premium, title="Cascade")
        conversation = self.conversation(self.premium, project=project)
        message = Message.objects.create(conversation=conversation, role=Message.Role.USER, content="file")
        attachment = Attachment.objects.create(
            message=message,
            file=SimpleUploadedFile("cascade.txt", b"secret", content_type="text/plain"),
            original_name="cascade.txt",
            content_type="text/plain",
            size_bytes=6,
        )
        file_path = attachment.file.path
        self.assertTrue(os.path.exists(file_path))
        self.auth(self.premium)

        response = self.client.delete(reverse("project-detail", args=[project.pk]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Project.objects.filter(pk=project.pk).exists())
        self.assertFalse(Conversation.objects.filter(pk=conversation.pk).exists())
        self.assertFalse(Message.objects.filter(pk=message.pk).exists())
        self.assertFalse(Attachment.objects.filter(pk=attachment.pk).exists())
        self.assertFalse(os.path.exists(file_path))

    def test_conversation_delete_is_soft_and_default_list_excludes_it(self):
        keep = self.conversation(title="Keep")
        deleted = self.conversation(title="Delete")
        self.auth(self.user)

        response = self.client.delete(reverse("conversation-detail", args=[deleted.pk]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        deleted.refresh_from_db()
        self.assertEqual(deleted.status, Conversation.Status.DELETED)
        self.assertIsNotNone(deleted.deleted_at)

        list_response = self.client.get(reverse("conversation-list"))
        titles = {item["title"] for item in list_response.data["results"]}
        self.assertIn(keep.title, titles)
        self.assertNotIn(deleted.title, titles)

        deleted_list = self.client.get(reverse("conversation-list"), {"status": "deleted"})
        self.assertEqual(deleted_list.data["results"][0]["title"], "Delete")

    def test_inactive_model_cannot_be_used_for_new_message(self):
        conversation = self.conversation()
        self.free_model.is_active = False
        self.free_model.save(update_fields=["is_active"])
        self.auth(self.user)

        response = self.client.post(
            reverse("conversation-messages", args=[conversation.pk]),
            {"content": "Hello?"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(response.data["error"]["code"], "model_not_available")

    def test_project_conversations_endpoint_excludes_soft_deleted(self):
        project = Project.objects.create(owner=self.user, title="Project")
        active = self.conversation(project=project, title="Active")
        deleted = self.conversation(project=project, title="Deleted", status=Conversation.Status.DELETED, deleted_at=timezone.now())
        self.auth(self.user)

        response = self.client.get(reverse("project-conversations", args=[project.pk]))

        self.assert_paginated_response(response)
        titles = {item["title"] for item in response.data["results"]}
        self.assertIn(active.title, titles)
        self.assertNotIn(deleted.title, titles)

    def test_project_conversations_search_and_ordering_are_supported(self):
        project = Project.objects.create(owner=self.user, title="Project")
        self.conversation(project=project, title="Beta")
        self.conversation(project=project, title="Alpha")
        self.auth(self.user)

        searched = self.client.get(reverse("project-conversations", args=[project.pk]), {"search": "Beta"})
        ordered = self.client.get(reverse("project-conversations", args=[project.pk]), {"ordering": "title"})

        self.assert_paginated_response(searched)
        self.assertEqual([item["title"] for item in searched.data["results"]], ["Beta"])
        self.assert_paginated_response(ordered)
        self.assertEqual([item["title"] for item in ordered.data["results"]], ["Alpha", "Beta"])

    def test_conversation_messages_endpoint_is_paginated_oldest_to_newest(self):
        conversation = self.conversation()
        first = Message.objects.create(conversation=conversation, role=Message.Role.USER, content="first")
        second = Message.objects.create(conversation=conversation, role=Message.Role.ASSISTANT, content="second")
        self.auth(self.user)

        response = self.client.get(reverse("conversation-messages", args=[conversation.pk]))

        self.assert_paginated_response(response)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual([item["id"] for item in response.data["results"]], [first.pk, second.pk])

    def test_custom_list_schema_query_parameters_match_runtime_support(self):
        schema_response = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json")
        schema = json.loads(schema_response.content)

        project_params = {param["name"] for param in schema["paths"]["/api/projects/{id}/conversations/"]["get"]["parameters"]}
        message_params = {param["name"] for param in schema["paths"]["/api/conversations/{id}/messages/"]["get"]["parameters"]}
        attachment_params = {param["name"] for param in schema["paths"]["/api/messages/{id}/attachments/"]["get"]["parameters"]}

        self.assertIn("search", project_params)
        self.assertIn("ordering", project_params)
        self.assertIn("page", project_params)
        self.assertNotIn("search", message_params)
        self.assertNotIn("ordering", message_params)
        self.assertIn("page", message_params)
        self.assertNotIn("search", attachment_params)
        self.assertNotIn("ordering", attachment_params)
        self.assertIn("page", attachment_params)

    def test_message_send_multipart_schema_documents_binary_file_inputs(self):
        schema_response = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json")
        self.assertEqual(schema_response.status_code, status.HTTP_200_OK)
        schema = json.loads(schema_response.content)
        operation = schema["paths"]["/api/conversations/{id}/messages/"]["post"]
        request_content = operation["requestBody"]["content"]

        self.assertIn("application/json", request_content)
        self.assertIn("multipart/form-data", request_content)
        multipart_schema = request_content["multipart/form-data"]["schema"]
        properties = multipart_schema["properties"]

        self.assertEqual(properties["content"]["type"], "string")
        self.assertEqual(properties["file"], {"type": "string", "format": "binary"})
        self.assertEqual(properties["files"]["type"], "array")
        self.assertEqual(properties["files"]["items"], {"type": "string", "format": "binary"})
        self.assertNotEqual(properties["file"].get("format"), "uri")
        self.assertNotEqual(properties["files"]["items"].get("format"), "uri")
        self.assertIn("PremiumFileUpload", request_content["multipart/form-data"]["examples"])

        responses = operation["responses"]
        self.assertIn("400", responses)
        self.assertIn("403", responses)
        self.assertIn("OversizedFile", responses["400"]["content"]["application/json"]["examples"])
        self.assertIn("premium_required", json.dumps(responses["403"]))

    def test_attachment_download_schema_documents_binary_success_and_json_errors(self):
        schema_response = self.client.get(reverse("schema"), HTTP_ACCEPT="application/json")
        self.assertEqual(schema_response.status_code, status.HTTP_200_OK)
        schema = json.loads(schema_response.content)
        responses = schema["paths"]["/api/attachments/{id}/download/"]["get"]["responses"]

        success_content = responses["200"]["content"]
        self.assertEqual(list(success_content.keys()), ["application/octet-stream"])
        self.assertEqual(success_content["application/octet-stream"]["schema"], {"type": "string", "format": "binary"})
        self.assertEqual(list(responses["404"]["content"].keys()), ["application/json"])
        self.assertEqual(list(responses["410"]["content"].keys()), ["application/json"])
        self.assertIn("NotFound", responses["404"]["content"]["application/json"]["examples"])
        self.assertIn("AttachmentFileMissing", responses["410"]["content"]["application/json"]["examples"])
