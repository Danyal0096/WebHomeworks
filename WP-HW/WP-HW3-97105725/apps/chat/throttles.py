from __future__ import annotations

from django.utils import timezone
from rest_framework.throttling import BaseThrottle

from apps.accounts.models import User
from apps.subscriptions.services import FREE_DAILY_LIMIT, local_day_bounds, used_messages_today


class DailyFreeMessageThrottle(BaseThrottle):
    def allow_request(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return True
        if user.subscription_type == User.SubscriptionType.PREMIUM:
            return True
        used = used_messages_today(user)
        if used < FREE_DAILY_LIMIT:
            return True
        request.quota_throttle_details = {
            "limit": FREE_DAILY_LIMIT,
            "used": used,
            "remaining": 0,
        }
        _, end = local_day_bounds()
        self._wait = max(int((end - timezone.now()).total_seconds()), 1)
        return False

    def wait(self) -> int | None:
        return getattr(self, "_wait", None)
