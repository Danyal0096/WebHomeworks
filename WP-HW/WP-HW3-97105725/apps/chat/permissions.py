from rest_framework.permissions import SAFE_METHODS, BasePermission


class IsSuperUserOrReadOnly(BasePermission):
    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_superuser)


class AssistantPermission(BasePermission):
    def has_object_permission(self, request, view, obj) -> bool:
        if request.method in SAFE_METHODS:
            return obj.is_public or obj.owner_id == request.user.id
        if obj.is_public:
            return request.user.is_superuser
        return obj.owner_id == request.user.id
