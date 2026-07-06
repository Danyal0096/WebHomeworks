from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.core.openapi import VALIDATION_ERROR, example, x_examples

from .serializers import PlanSerializer, PurchaseSerializer, SubscriptionStatusSerializer
from .services import PLANS, purchase_plan, subscription_status


plans_example = [
    {
        "plan": "FREE",
        "daily_limit": 50,
        "description": "Access to basic models with a daily limit of 50 messages.",
        "entitlements": {"models": "Basic active models", "attachments": False, "daily_messages": 50},
    },
    {
        "plan": "PREMIUM",
        "daily_limit": None,
        "description": "Access to all active models with unlimited messages and attachments.",
        "entitlements": {"models": "All active models", "attachments": True, "daily_messages": None},
    },
]
status_example = {
    "plan": "FREE",
    "daily_limit": 50,
    "used_today": 12,
    "remaining_today": 38,
    "entitlements": {"all_active_models": False, "attachments": False, "unlimited_messages": False},
}


class PlansView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        responses={200: PlanSerializer(many=True)},
        examples=[example("Plans response", plans_example, response_only=True, status_codes=["200"])],
        extensions=x_examples(("Plans response", plans_example)),
        tags=["Subscription"],
    )
    def get(self, request):
        return Response(list(PLANS.values()))


class SubscriptionStatusView(APIView):
    @extend_schema(
        responses={200: SubscriptionStatusSerializer},
        examples=[example("Subscription status", status_example, response_only=True, status_codes=["200"])],
        extensions=x_examples(("Subscription status", status_example)),
        tags=["Subscription"],
    )
    def get(self, request):
        return Response(subscription_status(request.user))


class PurchaseView(APIView):
    @extend_schema(
        request=PurchaseSerializer,
        responses={200: SubscriptionStatusSerializer},
        examples=[
            OpenApiExample("Purchase premium", value={"plan": "PREMIUM"}, request_only=True),
            example(
                "Premium status",
                {
                    "plan": "PREMIUM",
                    "daily_limit": None,
                    "used_today": 12,
                    "remaining_today": None,
                    "entitlements": {"all_active_models": True, "attachments": True, "unlimited_messages": True},
                },
                response_only=True,
                status_codes=["200"],
            ),
            VALIDATION_ERROR,
        ],
        extensions=x_examples(
            ("Purchase request", {"plan": "PREMIUM"}),
            (
                "Premium status",
                {
                    "plan": "PREMIUM",
                    "daily_limit": None,
                    "used_today": 12,
                    "remaining_today": None,
                    "entitlements": {"all_active_models": True, "attachments": True, "unlimited_messages": True},
                },
            ),
            ("Validation error", VALIDATION_ERROR.value),
        ),
        tags=["Subscription"],
    )
    def post(self, request):
        serializer = PurchaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        purchase_plan(request.user, User.SubscriptionType.PREMIUM)
        return Response(subscription_status(request.user), status=status.HTTP_200_OK)
