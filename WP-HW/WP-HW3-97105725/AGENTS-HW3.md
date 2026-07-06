# AGENTS.md — Web Programming Homework 3: Django/DRF ChatGPT-Like Backend

## 1. Mission

Build a complete backend for a ChatGPT-like service for Web Programming Homework 3.

This is an API-only backend project. Do **not** build a frontend.

Use:
- Django
- Django REST Framework (DRF)
- SQLite
- JWT authentication
- Swagger/OpenAPI documentation
- Django's built-in test framework and DRF test utilities

The final project must be runnable locally, documented, tested, and suitable for inspection through Swagger UI.

Do not stop after planning or scaffolding. Implement the full backend, write meaningful tests early, run the tests, fix failures, and produce a complete README.

---

## 2. Hard Constraints

### Mandatory stack
- Django is the only web framework.
- Django REST Framework is mandatory.
- SQLite is mandatory.
- JWT authentication is mandatory.
- Use `djangorestframework-simplejwt` for JWT.
- Use `drf-spectacular` for OpenAPI/Swagger documentation.
- Use Django's standard test runner / `TestCase` / `APITestCase`; do not require pytest.
- At least 15 meaningful tests are required. Target **20+**.
- No Flask, FastAPI, Next.js, custom server layer, or another web framework.

### Package policy
Keep dependencies minimal. Required packages:
- Django
- djangorestframework
- djangorestframework-simplejwt
- drf-spectacular

Do not add unrelated packages merely for convenience.

### Submission hygiene
Create `.gitignore` and exclude at least:
- `.venv/`
- `venv/`
- `__pycache__/`
- `*.pyc`
- `.pytest_cache/`
- `.coverage`
- `htmlcov/`
- `.env`
- `media/`
- `db.sqlite3`

Do not upload virtual environments, cached files, local media uploads, or secrets.

---

## 3. Required Deliverables

The completed workspace must include:

1. Django project with clean app separation.
2. SQLite-backed models and migrations.
3. REST endpoints listed in this specification.
4. JWT register/login/profile endpoints.
5. Ownership isolation and permissions.
6. Subscription and daily quota throttling.
7. AI model selection and mock replies.
8. Public/private assistants.
9. Projects, conversations, messages, and attachments.
10. Account linking and account switching.
11. Swagger docs with examples for every endpoint.
12. At least 20 meaningful tests, with at least 15 passing backend tests as a minimum.
13. A `seed_demo` management command.
14. A comprehensive `README.md` with setup, run, test, Swagger URL, and demo credentials.

---

## 4. Suggested Project Structure

Use a clean, practical layout. Equivalent structure is allowed if responsibilities stay clear.

```text
chatgpt_backend/
  manage.py
  requirements.txt
  README.md
  .gitignore

  config/
    settings.py
    urls.py
    wsgi.py
    asgi.py
    middleware.py
    exceptions.py

  apps/
    accounts/
      models.py
      serializers.py
      permissions.py
      services.py
      views.py
      urls.py
      tests/
    chat/
      models.py
      serializers.py
      permissions.py
      services.py
      throttles.py
      views.py
      urls.py
      tests/
    subscriptions/
      serializers.py
      services.py
      views.py
      urls.py
      tests/
    core/
      views.py
      urls.py
      management/commands/seed_demo.py
      tests/

  media/               # runtime only, gitignored
```

### Separation rules
- Serializers validate request data and shape responses.
- ViewSets/views coordinate request/response, not deep business logic.
- Services contain business rules such as model access, mock replies, quota calculations, account linking, and title generation.
- Permissions and queryset filtering enforce ownership.
- Throttles enforce daily free-tier message limits.
- Do not put major business logic inside model `save()` methods.
- Keep the implementation readable; do not over-abstract trivial one-off code.

---

## 5. Global API Conventions

### Base paths
Use these route families exactly:

```text
/api/auth/...
/api/projects/...
/api/conversations/...
/api/messages/...
/api/models/...
/api/assistants/...
/api/subscription/...
/api/health/
```

Always use trailing slashes.

### Authentication
- Default permission: authenticated users only.
- Register, login, Swagger/schema, health, and plan listing may be public.
- All private resources require `Authorization: Bearer <access_token>`.

### Ownership / anti-leak rule
For user-owned resources, use filtered querysets and return `404 Not Found` when an object does not belong to the current user. Do not leak cross-user object existence.

This applies at minimum to:
- projects,
- conversations,
- messages,
- attachments,
- private assistants,
- account-switch targets.

### Structured error responses
Use one consistent API error shape, via a custom DRF exception handler.

```json
{
  "error": {
    "code": "validation_error",
    "message": "The request contains invalid data.",
    "details": {
      "email": ["This field must be unique."]
    }
  },
  "request_id": "f3d6e3ce-32e8-4adc-9cf6-863a1b6fa4f2"
}
```

Use sensible codes such as:
- `validation_error`
- `authentication_failed`
- `permission_denied`
- `not_found`
- `quota_exceeded`
- `premium_required`
- `invalid_credentials`
- `model_not_available`
- `assistant_not_available`
- `conversation_deleted`
- `internal_error`

### Request IDs
Implement middleware that:
- accepts incoming `X-Request-ID` if present and reasonably valid,
- otherwise generates a UUID,
- attaches it to every response as `X-Request-ID`,
- ensures error responses include the same request ID.

### Health endpoint
Implement:

```text
GET /api/health/
```

Return a minimal health response including database reachability and application version:

```json
{
  "status": "ok",
  "database": "reachable",
  "version": "1.0.0"
}
```

---

## 6. Data Models

## 6.1 User

Create a custom user model extending `AbstractUser`.

Required fields:
- `username` — unique.
- `email` — required and unique.
- password — normal Django password hashing.
- `subscription_type` — `FREE` or `PREMIUM`; default `FREE`.
- `linked_accounts` — symmetric self-referential many-to-many relation for two-way account linking.

Profile uses:
- `first_name`
- `last_name`
- `email`
- `username`
- `subscription_type`

Do not expose password hashes or sensitive internal fields.

## 6.2 Project

Fields:
- `owner` — FK to User.
- `title`
- `description` — blank allowed.
- `created_at`
- `updated_at`

Rules:
- A Project belongs to exactly one user.
- A Project contains zero or more Conversations.
- Deleting a Project is a **hard delete** and must cascade-delete its conversations, messages, attachment records, and physical attachment files.

## 6.3 AIModel

Fields:
- `name` — unique.
- `provider`
- `is_active`
- `minimum_subscription` — `FREE` or `PREMIUM`.
- `created_at`
- `updated_at`

Rules:
- Normal users have read-only access.
- Superusers have full CRUD access.
- Inactive models cannot be selected for new/updated conversations or used to send new messages.
- Free users may select only models whose minimum subscription is FREE.
- Premium users may select all active models.

Seed these models:
1. `GPT-3.5 Turbo` — provider `OpenAI` — active — FREE.
2. `GPT-4` — provider `OpenAI` — active — PREMIUM.
3. `Claude 3` — provider `Anthropic` — active — PREMIUM.

## 6.4 Assistant

Fields:
- `title`
- `description`
- `system_prompt`
- `is_public`
- `owner` — nullable FK to User for private assistants.
- `created_at`
- `updated_at`

Rules:
- Public assistants have `is_public=True` and `owner=None`.
- Private assistants have `is_public=False` and an owner.
- Normal users can list public assistants plus their own private assistants.
- Normal users may create/edit/delete only their own private assistants.
- Public assistants are read-only for normal users.
- Superusers may manage public assistants.
- A Conversation may select zero or one accessible Assistant.

Seed public assistants:
1. General Assistant
2. Translator
3. Coding Assistant

## 6.5 Conversation

Fields:
- `owner` — FK to User.
- `project` — nullable FK to Project with `on_delete=CASCADE`.
- `ai_model` — FK to AIModel.
- `assistant` — nullable FK to Assistant, use `SET_NULL`.
- `title`
- `status` — `ACTIVE`, `ARCHIVED`, `DELETED`.
- `created_at`
- `updated_at`
- `last_message_at`
- optional `deleted_at`

Rules:
- Conversation belongs to one user.
- Project, if present, must belong to the same user.
- New conversation defaults to ACTIVE.
- If title is omitted/blank, generate a timestamp-based title, for example `New conversation — 2026-06-21 14:32`.
- Normal conversation delete is a **soft delete**: set status DELETED and deleted_at, do not remove messages.
- Deleted conversations are excluded from normal list results.
- Owner may restore ARCHIVED or DELETED conversations to ACTIVE.
- Owner may archive active conversations.
- When a new message is sent, update `last_message_at` and `updated_at`.

## 6.6 Message

Fields:
- `conversation` — FK to Conversation.
- `role` — `USER`, `SYSTEM`, `ASSISTANT`.
- `content` — text; allow blank only if one or more attachments are uploaded.
- `created_at`
- `updated_at`

Rules:
- User sends USER messages.
- The backend automatically creates ASSISTANT mock replies.
- System messages may exist for internal/seed use but are immutable to normal users.
- Only the conversation owner may read messages.
- Only USER-role messages can be edited/deleted.
- Individual message deletion is a **hard delete**.
- Deleting a Message must delete its Attachment records and physical files.

## 6.7 Attachment

Fields:
- `message` — FK to Message.
- `file` — FileField.
- `original_name`
- `content_type`
- `size_bytes`
- `uploaded_at`

Rules:
- A Message may have zero or more attachments.
- Attachment records are private to the owner of the parent Conversation.
- Provide protected download, not only open public media URLs.
- Use a `post_delete` signal or equivalent robust mechanism to remove physical files when Attachment is deleted.

---

## 7. Authentication and Account Switching

## 7.1 Authentication endpoints

Implement exactly:

```text
POST  /api/auth/register/
POST  /api/auth/login/
GET   /api/auth/profile/
PATCH /api/auth/profile/
```

### Register
Request fields:
- `username`
- `email`
- `password`
- `password_confirm`
- optional `first_name`, `last_name`

Rules:
- Email and username must be unique.
- Validate password confirmation.
- Return user profile and JWT access/refresh tokens after successful registration.

### Login
Request shape:

```json
{
  "identifier": "username-or-email",
  "password": "password"
}
```

Rules:
- `identifier` accepts either username or email.
- Return SimpleJWT access and refresh tokens plus safe profile data.
- Invalid login must return the structured `invalid_credentials` error.

### Profile
- `GET /api/auth/profile/` returns the current safe profile.
- `PATCH /api/auth/profile/` allows updating first name, last name, email, and username subject to uniqueness rules.
- Do not allow ordinary profile PATCH to set subscription type, admin flags, password hash, or linked accounts.

## 7.2 Account link/switch endpoints

Implement exactly:

```text
POST /api/auth/link-account/
GET  /api/auth/linked-accounts/
POST /api/auth/switch/
```

### Link account
Authenticated request body:

```json
{
  "identifier": "other-user@example.com",
  "password": "their-password"
}
```

Rules:
- Verify the target account's credentials.
- Reject self-linking.
- On success, create a permanent **two-way** account link.
- Linking an already-linked account should be idempotent or return a clear validation response; do not create duplicates.

### Linked accounts
Return profiles of accounts linked to the current user, excluding sensitive fields.

### Switch account
Authenticated request body:

```json
{
  "account_id": 12
}
```

Rules:
- Target must be linked to the current account.
- Cross-user/non-linked target must return 404.
- Return freshly generated access and refresh JWT tokens for the target user plus safe target profile.

---

## 8. Subscription, Quota, and Throttling

Implement exactly:

```text
GET  /api/subscription/status/
GET  /api/subscription/plans/
POST /api/subscription/purchase/
```

### Plans
Two plans only:
- `FREE`
- `PREMIUM`

Plans endpoint can be public. Return static, well-documented data:
- FREE: access to basic models; daily limit 50 messages.
- PREMIUM: access to all active models; unlimited daily messages; attachment upload allowed.

### Purchase
Authenticated request body:

```json
{
  "plan": "PREMIUM"
}
```

Rules:
- No payment gateway is needed.
- Immediately change current user's subscription to PREMIUM.
- Purchase is idempotent for an already Premium user.
- No premium expiry is needed.

### Status
Authenticated response includes:
- current plan,
- `daily_limit` (50 or null for unlimited),
- `used_today`,
- `remaining_today` (or null for unlimited),
- model/attachment entitlement summary.

### Daily quota enforcement
Free users may send at most **50 USER messages per calendar day**. Premium users are unlimited.

Implement a custom DRF throttle class for the message-send endpoint:
- It must allow Premium users immediately.
- For Free users, count persisted USER messages created today for conversations owned by the current user.
- This makes quota accurate across restarts and fulfills the requirement to use DRF throttling.
- When quota is exceeded, return structured `quota_exceeded` error with useful details (`limit`, `used`, `remaining=0`).
- Calculate a sensible `wait()` until the next local day boundary if practical.

---

## 9. AI Models and Assistants

## 9.1 AI models

Use router/ViewSet endpoints:

```text
GET    /api/models/
GET    /api/models/<model_id>/
POST   /api/models/                 # superuser only
PATCH  /api/models/<model_id>/      # superuser only
DELETE /api/models/<model_id>/      # superuser only
```

Rules:
- Normal users can only list/retrieve.
- Superusers have full CRUD.
- Model selection validation is performed whenever a Conversation is created/updated or a message is sent.
- The selected model must be active and permitted by the current subscription.

## 9.2 Assistants

Use router/ViewSet endpoints:

```text
GET    /api/assistants/
POST   /api/assistants/
GET    /api/assistants/<assistant_id>/
PATCH  /api/assistants/<assistant_id>/
DELETE /api/assistants/<assistant_id>/
```

Rules:
- List public assistants plus current user's private assistants.
- POST always creates a private assistant owned by the requester; ordinary users cannot create public assistants by passing a flag.
- Retrieve/update/delete own private assistants only; return 404 for another user's private assistant.
- Public assistants are readable but immutable to normal users.
- Superusers may manage public assistants.
- Validate assistant selection for conversations: it must be public or owned by the requester.

---

## 10. Projects

Implement:

```text
GET    /api/projects/
POST   /api/projects/
GET    /api/projects/<project_id>/
PATCH  /api/projects/<project_id>/
DELETE /api/projects/<project_id>/
GET    /api/projects/<project_id>/conversations/
```

Rules:
- A user sees only their own projects.
- POST assigns `owner=request.user`; never accept arbitrary owner IDs.
- PATCH edits title/description only for owner.
- DELETE is hard delete and cascades through conversations/messages/attachments/files.
- Project-conversation list returns only the owner's conversations in that project.
- Default project-conversation list excludes soft-deleted conversations.
- Support `search` on title/description and `ordering` by safe fields such as `created_at`, `updated_at`, `title`.
- Use pagination with default page size 20 for project/conversation lists where practical.

---

## 11. Conversations

Implement:

```text
GET    /api/conversations/
POST   /api/conversations/
GET    /api/conversations/<conversation_id>/
PATCH  /api/conversations/<conversation_id>/
DELETE /api/conversations/<conversation_id>/
POST   /api/conversations/<conversation_id>/archive/
POST   /api/conversations/<conversation_id>/restore/
GET    /api/conversations/<conversation_id>/messages/
POST   /api/conversations/<conversation_id>/messages/
```

### List
- Owner-only queryset.
- Default excludes status DELETED.
- Support owner-only filter `?status=active|archived|deleted`.
- Support `?search=<text>` against title.
- Support `?ordering=created_at|-updated_at|-last_message_at|title` with a safe whitelist.
- Default ordering should be recent activity: `-last_message_at`, then `-created_at`.
- Paginate default page size 20.

### Create
Request supports:
- `title` optional.
- `project_id` optional.
- `ai_model_id` required.
- `assistant_id` optional.

Validation:
- selected Project belongs to requester,
- selected AI model is active and allowed for requester subscription,
- selected Assistant is public or requester-owned.

### Update
Allow owner to update:
- title,
- project,
- AI model,
- assistant,
- optionally status only through explicit archive/restore actions instead of arbitrary values.

Apply the same ownership/model/assistant validation.

### Delete, archive, restore
- DELETE soft-deletes: `status=DELETED`, preserve messages.
- `archive/` changes active conversation to ARCHIVED.
- `restore/` changes ARCHIVED or DELETED to ACTIVE.
- Deleted conversations must not allow sending messages until restored; return structured `conversation_deleted` error.

---

## 12. Messages, Mock AI, and Attachments

## 12.1 Message list

```text
GET /api/conversations/<conversation_id>/messages/
```

Rules:
- Only conversation owner.
- Paginated, default page size 20.
- Sort oldest to newest by default so chat history is natural.
- Return role, content, timestamps, and attachment metadata.

## 12.2 Send message and receive mock reply

```text
POST /api/conversations/<conversation_id>/messages/
```

Support JSON and `multipart/form-data`.

Input:
- `content` optional only when at least one file is supplied.
- single optional `file` field.
- repeated `files` fields also accepted for multiple files.

Rules:
1. Confirm conversation exists, belongs to requester, and is not deleted.
2. Validate selected conversation model remains active and subscription-allowed.
3. Apply daily Free quota throttle.
4. Reject empty request with no content and no files.
5. If files are present, require Premium; otherwise return `premium_required`.
6. Enforce max **10 MB per file**.
7. Store USER Message and attachments.
8. Create an ASSISTANT Message as a mock reply.
9. Update conversation `last_message_at` and `updated_at`.
10. Return both user message and assistant reply in one 201 response.

Mock response must be deterministic/clear and mention selected model. Example:

```text
[Mock response from GPT-4] I received your message: "Hello".
```

If an assistant is selected, it may additionally mention assistant title, but do not call any external AI API.

## 12.3 Edit/delete individual message

Implement:

```text
PATCH  /api/messages/<message_id>/
DELETE /api/messages/<message_id>/
```

Rules:
- Only owner of parent Conversation.
- Only USER-role messages are editable/deletable.
- ASSISTANT and SYSTEM messages are immutable to normal users.
- PATCH changes content only; validate non-empty content unless attachments exist.
- DELETE hard-deletes message, its attachment records, and physical files.
- Cross-user access returns 404.

## 12.4 Attachment listing/download

Implement:

```text
GET /api/messages/<message_id>/attachments/
GET /api/attachments/<attachment_id>/download/
```

Rules:
- Only owner of parent Conversation.
- List returns `id`, original filename, content type, size bytes, upload timestamp, and protected download URL.
- Download returns file through a protected `FileResponse`.
- Do not depend solely on a public media URL for private access.
- Ensure development media configuration permits local testing without exposing incorrect ownership behavior.

---

## 13. Swagger / OpenAPI Documentation

Use `drf-spectacular`.

Configure at minimum:

```text
GET /api/schema/
GET /api/docs/
```

`/api/docs/` must serve Swagger UI.

### Documentation requirements
- README must state the exact Swagger URL: `http://127.0.0.1:8000/api/docs/`.
- Every endpoint must appear in Swagger.
- Every endpoint must have accurate request and response schemas.
- Add realistic examples for successful requests/responses and important error responses.
- Include multipart message/file upload example in Swagger.
- Include JWT Bearer authentication scheme and mark protected endpoints.
- Document pagination query parameters and response envelope.
- Document `search`, `ordering`, `status`, and other supported query parameters.
- Document superuser-only model write operations.
- Do not leave generic/default schemas for complex custom actions if an explicit serializer/example can be supplied.

Swagger examples must be realistic, precise, and match actual serializer behavior.

---

## 14. Seed Data Command

Implement an idempotent command:

```bash
python manage.py seed_demo
```

It must:
- create/update the three AI models listed above,
- create/update the three public assistants listed above,
- create a superuser/admin demo user if absent,
- create one FREE demo user and one PREMIUM demo user if absent,
- create a small sample Project and Conversation if useful,
- print clearly which demo accounts exist and their passwords,
- never create duplicate named seed data on repeated runs.

Document demo credentials in README. Use obviously development-only passwords and warn users to change them outside demo use.

---

## 15. Tests and TDD Requirements

Use Django `TestCase`/`APITestCase` and DRF test tools. Write tests before or alongside each feature; do not leave all tests to the end.

Target at least **20 meaningful tests**. At least 15 are mandatory.

Minimum required test coverage:

1. Register creates a user and returns JWT tokens.
2. Login accepts username.
3. Login accepts email.
4. Profile owner can retrieve/patch safe fields.
5. Cross-user project retrieve/update/delete returns 404.
6. Cross-user conversation/message access returns 404.
7. Normal user cannot create/update/delete AI models.
8. Superuser can create/update AI models.
9. Private assistant is visible only to owner; public assistant is visible to all authenticated users.
10. Account linking creates a two-way relation.
11. Account switch returns fresh JWT for linked target and rejects unlinked target.
12. Free user cannot select Premium model.
13. Premium purchase upgrades user.
14. Free user quota allows message 1 through 50 and blocks 51st in the same day.
15. Premium user bypasses quota.
16. Message send creates USER and ASSISTANT mock messages and updates conversation activity.
17. Deleted conversation cannot receive messages; restore permits it again.
18. User can edit/delete only USER-role messages; assistant message edit/delete is blocked.
19. Free user attachment upload is blocked; Premium upload succeeds.
20. Attachment access is hidden from other users and protected download works for owner.
21. Project delete cascades through its conversations/messages/attachments.
22. Conversation DELETE is soft delete and default list excludes it.
23. Health endpoint returns expected response and request ID header.
24. Important validation error returns structured error envelope.

Use temporary media storage in tests and clean it up. Tests must not depend on network access or external AI APIs.

Run:

```bash
python manage.py test
```

Do not claim completion while tests fail.

---

## 16. README Requirements

Create `README.md` with:

1. Project purpose and feature summary.
2. Exact prerequisites.
3. Setup commands, including virtual environment creation.
4. Dependency installation:
   ```bash
   pip install -r requirements.txt
   ```
5. Migrations:
   ```bash
   python manage.py migrate
   ```
6. Optional seed setup:
   ```bash
   python manage.py seed_demo
   ```
7. Development server command:
   ```bash
   python manage.py runserver
   ```
8. Test command:
   ```bash
   python manage.py test
   ```
9. Swagger URL:
   ```text
   http://127.0.0.1:8000/api/docs/
   ```
10. API authentication instructions with example Bearer token usage.
11. Brief endpoint map.
12. Demo accounts produced by `seed_demo`.
13. Important limitations: model responses are mocked; browser frontend is not part of this homework; attachment serving is development-local.

---

## 17. Settings and Runtime Details

- Use SQLite database in Django settings.
- Set `AUTH_USER_MODEL` before first migration.
- Configure `REST_FRAMEWORK` defaults: JWT authentication, custom exception handler, schema class, pagination default 20.
- Configure `SPECTACULAR_SETTINGS` with title, description, version, and Bearer auth scheme.
- Configure `MEDIA_ROOT` and `MEDIA_URL` for local attachment testing.
- In development URLs, serve media only when `DEBUG=True`; private download endpoint remains the documented access mechanism.
- Never hard-code a production secret. Use a development fallback and permit environment override.
- Add custom request-ID middleware early enough that exception handling sees the ID.

---

## 18. Completion Checklist

Before considering the project complete, manually verify via Swagger or APIClient:

### Core quality
- [ ] `python manage.py check` passes.
- [ ] `python manage.py makemigrations --check --dry-run` has no unexpected changes.
- [ ] `python manage.py migrate` succeeds on clean SQLite DB.
- [ ] `python manage.py test` passes with 20+ meaningful tests.
- [ ] No external APIs are called.
- [ ] Requirements are minimal and installable.

### Docs and diagnostics
- [ ] `/api/health/` works.
- [ ] Every response has `X-Request-ID`.
- [ ] Structured errors work for validation, not found, permission, throttling, and unexpected errors.
- [ ] `/api/schema/` works.
- [ ] `/api/docs/` Swagger UI works.
- [ ] Swagger shows real request/response examples for all endpoints.
- [ ] README includes Swagger URL and local setup.

### Auth and security
- [ ] Register/login/profile works with JWT.
- [ ] Login supports username and email.
- [ ] Account link/switch works two-way.
- [ ] Cross-user projects/conversations/messages/private assistants/attachments return 404.
- [ ] AI Model write permissions are superuser-only.

### Product flows
- [ ] Project CRUD and project conversation list work.
- [ ] Project deletion cascades as specified.
- [ ] Conversation create/update/search/order/archive/restore/soft-delete work.
- [ ] Message pagination, send, mock response, edit/delete work.
- [ ] Free quota and Premium upgrade/model permissions work.
- [ ] Assistant visibility/CRUD and selection validation work.
- [ ] Premium attachments work; free attachments are rejected.
- [ ] Protected attachment listing/download works.

---

## 19. Completion Instructions for Codex

1. Inspect the current workspace before coding.
2. Create the Django/DRF project and requirements file if absent.
3. Implement models and migrations first.
4. Implement tests alongside each feature, not only at the end.
5. Implement serializers/services/permissions/throttles/views/URLs cleanly.
6. Configure Swagger with examples for every endpoint.
7. Add seed command and README.
8. Run migrations, checks, tests, and local API/Swagger verification.
9. Fix all failures you can reproduce.
10. At the end, report:
    - all created/changed files,
    - architecture decisions,
    - endpoint map,
    - test count and result,
    - Swagger URL,
    - any limitations that are genuinely unavoidable.

Do not claim a feature works unless it was verified in tests, Swagger, or code inspection.

Build the complete backend, not a partial mock-up.
