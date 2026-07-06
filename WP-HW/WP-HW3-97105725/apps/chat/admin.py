from django.contrib import admin

from .models import AIModel, Assistant, Attachment, Conversation, Message, Project


admin.site.register(Project)
admin.site.register(AIModel)
admin.site.register(Assistant)
admin.site.register(Conversation)
admin.site.register(Message)
admin.site.register(Attachment)
