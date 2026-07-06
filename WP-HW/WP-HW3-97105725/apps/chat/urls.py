from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AIModelViewSet, AssistantViewSet, AttachmentViewSet, ConversationViewSet, MessageViewSet, ProjectViewSet

router = DefaultRouter()
router.register("projects", ProjectViewSet, basename="project")
router.register("conversations", ConversationViewSet, basename="conversation")
router.register("messages", MessageViewSet, basename="message")
router.register("models", AIModelViewSet, basename="model")
router.register("assistants", AssistantViewSet, basename="assistant")
router.register("attachments", AttachmentViewSet, basename="attachment")

urlpatterns = [
    path("", include(router.urls)),
]
