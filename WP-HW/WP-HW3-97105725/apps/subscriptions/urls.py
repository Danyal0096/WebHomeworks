from django.urls import path

from .views import PlansView, PurchaseView, SubscriptionStatusView

urlpatterns = [
    path("status/", SubscriptionStatusView.as_view(), name="subscription-status"),
    path("plans/", PlansView.as_view(), name="subscription-plans"),
    path("purchase/", PurchaseView.as_view(), name="subscription-purchase"),
]
