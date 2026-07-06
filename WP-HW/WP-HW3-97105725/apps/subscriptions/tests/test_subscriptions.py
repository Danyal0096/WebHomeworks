from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


User = get_user_model()


class SubscriptionTests(APITestCase):
    def test_plans_endpoint_is_public(self):
        response = self.client.get(reverse("subscription-plans"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual({plan["plan"] for plan in response.data}, {"FREE", "PREMIUM"})

    def test_premium_purchase_upgrades_user_and_is_idempotent(self):
        user = User.objects.create_user(username="buyer", email="buyer@example.com", password="StrongPass123!")
        self.client.force_authenticate(user)

        first = self.client.post(reverse("subscription-purchase"), {"plan": "PREMIUM"}, format="json")
        second = self.client.post(reverse("subscription-purchase"), {"plan": "PREMIUM"}, format="json")

        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.subscription_type, "PREMIUM")
        self.assertIsNone(second.data["daily_limit"])
