from django.conf import settings
from django.db import connection
from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework import permissions
from rest_framework.response import Response
from rest_framework.views import APIView

from .openapi import x_examples


class HealthView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        responses={
            200: {
                "type": "object",
                "properties": {
                    "status": {"type": "string"},
                    "database": {"type": "string"},
                    "version": {"type": "string"},
                },
            }
        },
        examples=[
            OpenApiExample(
                "Healthy response",
                value={"status": "ok", "database": "reachable", "version": "1.0.0"},
                response_only=True,
                status_codes=["200"],
            )
        ],
        extensions=x_examples(("Healthy response", {"status": "ok", "database": "reachable", "version": "1.0.0"})),
        tags=["Core"],
    )
    def get(self, request):
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        return Response({"status": "ok", "database": "reachable", "version": settings.APP_VERSION})
