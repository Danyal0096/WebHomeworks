from rest_framework import serializers


class PlanSerializer(serializers.Serializer):
    plan = serializers.ChoiceField(choices=["FREE", "PREMIUM"])
    daily_limit = serializers.IntegerField(allow_null=True)
    description = serializers.CharField()
    entitlements = serializers.DictField()


class SubscriptionStatusSerializer(serializers.Serializer):
    plan = serializers.ChoiceField(choices=["FREE", "PREMIUM"])
    daily_limit = serializers.IntegerField(allow_null=True)
    used_today = serializers.IntegerField()
    remaining_today = serializers.IntegerField(allow_null=True)
    entitlements = serializers.DictField()


class PurchaseSerializer(serializers.Serializer):
    plan = serializers.ChoiceField(choices=["PREMIUM"])
