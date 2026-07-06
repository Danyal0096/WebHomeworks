from __future__ import annotations

from django.utils import timezone

from apps.accounts.models import User
from apps.chat.models import Message


FREE_DAILY_LIMIT = 50


PLANS = {
    "FREE": {
        "plan": "FREE",
        "daily_limit": FREE_DAILY_LIMIT,
        "description": "Access to basic models with a daily limit of 50 messages.",
        "entitlements": {
            "models": "Basic active models",
            "attachments": False,
            "daily_messages": FREE_DAILY_LIMIT,
        },
    },
    "PREMIUM": {
        "plan": "PREMIUM",
        "daily_limit": None,
        "description": "Access to all active models with unlimited messages and attachments.",
        "entitlements": {
            "models": "All active models",
            "attachments": True,
            "daily_messages": None,
        },
    },
}


def local_day_bounds():
    today = timezone.localdate()
    start = timezone.make_aware(timezone.datetime.combine(today, timezone.datetime.min.time()))
    end = start + timezone.timedelta(days=1)
    return start, end


def used_messages_today(user: User) -> int:
    start, end = local_day_bounds()
    return Message.objects.filter(
        conversation__owner=user,
        role=Message.Role.USER,
        created_at__gte=start,
        created_at__lt=end,
    ).count()


def subscription_status(user: User) -> dict:
    used_today = used_messages_today(user)
    is_premium = user.subscription_type == User.SubscriptionType.PREMIUM
    daily_limit = None if is_premium else FREE_DAILY_LIMIT
    return {
        "plan": user.subscription_type,
        "daily_limit": daily_limit,
        "used_today": used_today,
        "remaining_today": None if is_premium else max(FREE_DAILY_LIMIT - used_today, 0),
        "entitlements": {
            "all_active_models": is_premium,
            "attachments": is_premium,
            "unlimited_messages": is_premium,
        },
    }


def purchase_plan(user: User, plan: str) -> User:
    if plan == User.SubscriptionType.PREMIUM and user.subscription_type != User.SubscriptionType.PREMIUM:
        user.subscription_type = User.SubscriptionType.PREMIUM
        user.save(update_fields=["subscription_type"])
    return user
