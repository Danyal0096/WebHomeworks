from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.chat.models import AIModel, Assistant, Conversation, Project, SubscriptionLevel


DEMO_PASSWORD = "DemoPass123!"


class Command(BaseCommand):
    help = "Seed demo AI models, public assistants, and development users."

    def handle(self, *args, **options):
        User = get_user_model()

        model_specs = [
            ("GPT-3.5 Turbo", "OpenAI", True, SubscriptionLevel.FREE),
            ("GPT-4", "OpenAI", True, SubscriptionLevel.PREMIUM),
            ("Claude 3", "Anthropic", True, SubscriptionLevel.PREMIUM),
        ]
        for name, provider, is_active, minimum_subscription in model_specs:
            AIModel.objects.update_or_create(
                name=name,
                defaults={
                    "provider": provider,
                    "is_active": is_active,
                    "minimum_subscription": minimum_subscription,
                },
            )

        assistants = [
            ("General Assistant", "General-purpose helpful assistant.", "You are helpful, clear, and concise."),
            ("Translator", "Translates text between languages.", "Translate accurately and preserve meaning."),
            ("Coding Assistant", "Helps with programming questions.", "Explain code and provide practical examples."),
        ]
        for title, description, prompt in assistants:
            Assistant.objects.update_or_create(
                title=title,
                is_public=True,
                owner=None,
                defaults={"description": description, "system_prompt": prompt},
            )

        admin = self._upsert_user(
            User,
            username="admin_demo",
            email="admin@example.com",
            is_staff=True,
            is_superuser=True,
            subscription_type=User.SubscriptionType.PREMIUM,
        )
        free = self._upsert_user(
            User,
            username="free_demo",
            email="free@example.com",
            subscription_type=User.SubscriptionType.FREE,
        )
        premium = self._upsert_user(
            User,
            username="premium_demo",
            email="premium@example.com",
            subscription_type=User.SubscriptionType.PREMIUM,
        )

        basic_model = AIModel.objects.get(name="GPT-3.5 Turbo")
        project, _ = Project.objects.get_or_create(
            owner=free,
            title="Demo Project",
            defaults={"description": "Seeded sample project for local API exploration."},
        )
        Conversation.objects.get_or_create(
            owner=free,
            project=project,
            title="Demo Conversation",
            defaults={"ai_model": basic_model},
        )

        self.stdout.write(self.style.SUCCESS("Seed data ready."))
        self.stdout.write("Demo accounts:")
        for user in (admin, free, premium):
            self.stdout.write(f"- {user.username} / {user.email} / password: {DEMO_PASSWORD}")

    def _upsert_user(self, User, **kwargs):
        username = kwargs.pop("username")
        email = kwargs.pop("email")
        user, created = User.objects.get_or_create(username=username, defaults={"email": email, **kwargs})
        for field, value in {"email": email, **kwargs}.items():
            setattr(user, field, value)
        user.set_password(DEMO_PASSWORD)
        user.save()
        return user
