# AGENTS.md — Web Programming Homework 2: Client-Side Postman Clone

## 1. Mission

Build a polished, complete client-side Postman-like HTTP request application for Web Programming Homework 2.

Use **React + Vite + TypeScript**. The app runs entirely in the browser: use browser-native `fetch` to send requests and `localStorage` to persist data. There is no backend, server-side route, proxy, public CORS proxy, or Next.js layer.

This is not a mock-up. Implement every listed feature, run the app, test it, and fix problems before declaring it finished.

## 2. Hard Constraints

- Use React, Vite, TypeScript, native `fetch`, and `localStorage`.
- English-only LTR interface.
- Keep dependencies deliberately minimal. `lucide-react` is allowed for icons.
- Do not add Redux, Zustand, TanStack Query, Axios, React Router, UI frameworks, form libraries, toast libraries, or styling frameworks.
- Use local reusable components for buttons, toast feedback, modals, and confirmation dialogs.
- Use clean CSS with variables/tokens and support light and dark mode.
- Do not use a backend/proxy to bypass CORS. Explain browser network/CORS limitations clearly.
- Every visible control must work. No placeholder buttons, fake actions, static mock data, or dead icons.
- Keep code clean and separated by responsibility. Do not create one giant `App.tsx`, one giant reducer, or duplicate Params/Headers logic.

## 3. Product Layout

Desktop:
- Persistent **left sidebar**: Collections, History, individual/bulk import/export, dark-mode control.
- Main workspace: tab bar, request builder, response viewer.

Mobile:
- Sidebar becomes a slide-out drawer opened by a hamburger button.
- Main workspace remains usable without app-level horizontal overflow.
- Close the drawer after opening a saved request/history entry when appropriate.

Use a professional, compact interface: clear hierarchy, readable status/error states, good spacing, sensible empty states, visible focus states. Avoid bloated dashboard decoration, huge rounded cards, and visual clutter.

## 4. Suggested Structure

```text
src/
  app/           App, provider, reducer, types
  components/
    common/      buttons, modal, confirm dialog, toast, empty/error states
    layout/      sidebar, mobile drawer, workspace shell
    tabs/        tab bar and tab item
    request/     URL, method, params, headers, body, actions
    response/    response metadata and Body/Headers/Raw views
    collections/ collection and saved-request UI/dialogs
    history/     history UI
    settings/    theme control
  services/      request, storage, collection, import/export services
  hooks/         media-query and toast hooks
  utils/         ids, dates, URL/query, JSON, cURL, comparison, file helpers
  styles/        reset, tokens, responsive CSS
```

Equivalent separation is fine. UI components must not directly manipulate `localStorage` or build fetch options inline everywhere.

## 5. Core Models

Use explicit TypeScript types equivalent to these:

```ts
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type BodyMode = "none" | "raw" | "json";

export interface KeyValueRow {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export interface RequestBody {
  mode: BodyMode;
  content: string;
}

export interface RequestConfig {
  method: HttpMethod;
  baseUrl: string;
  params: KeyValueRow[];
  headers: KeyValueRow[];
  body: RequestBody;
}

export interface ResponseSnapshot {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  rawBody: string;
  parsedJson: unknown | null;
  contentType: string | null;
  durationMs: number;
  sizeBytes: number;
}

export interface RequestErrorState {
  kind: "validation" | "json" | "network" | "cors" | "unsupported-body" | "unknown";
  message: string;
  details?: string;
}

export interface RequestTab {
  id: string;
  title: string;
  request: RequestConfig;
  linkedSavedRequestId: string | null;
  response: ResponseSnapshot | null;
  error: RequestErrorState | null;
  isLoading: boolean;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SavedRequest {
  id: string;
  name: string;
  collectionId: string;
  request: RequestConfig;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEntry {
  id: string;
  request: RequestConfig;
  finalUrl: string;
  timestamp: string;
  status: number | null;
  statusText: string | null;
  durationMs: number | null;
  errorKind: RequestErrorState["kind"] | null;
  errorMessage: string | null;
}
```

Persist collections, saved requests, tabs, active tab, history, default collection ID, and theme.

Do **not** persist response body/headers, loading state, or transient errors. On reload restore request configurations and tab links, but clear response/error/loading.

## 6. Startup

On first launch:
1. Create one collection named exactly `Saved Requests`.
2. Mark it as the default save target.
3. Create one blank active request tab.
4. Do not preload a sample request.

A blank tab starts with GET, empty URL, one empty Params row, one empty Headers row, body mode `none`, empty body, no response/error, and no saved-request link.


## 7. Tabs

- Support multiple independent request tabs.
- `+` creates a fresh independent blank tab.
- Tabs can be selected, renamed, closed, and duplicated.
- Closing a tab needs no confirmation.
- If the user closes the last tab, create a new blank tab immediately.
- Persist all open tabs and the active tab after reload.
- Use a compact fallback title such as `Untitled Request` or method + host/path.

### Duplicate active tab
- Copy request configuration only.
- Do not copy response, loading, or error state.
- Set `linkedSavedRequestId: null`; a duplicate is independent.

### Saved request linkage
When a user clicks a saved request in a collection:
- Open it in a **new tab**.
- Copy its request configuration.
- Set `linkedSavedRequestId` to the saved request ID.

For a linked tab:
- `Save` updates the linked stored request.
- `Save as new request` creates another saved request.
- `Clear all fields` does **not** remove the linked parent relationship.
- Users may clear and completely rewrite the request, then intentionally save it back to the parent.
- A truly independent blank request comes from `+ New Tab`.

Show a small dirty marker such as `•` if a linked tab’s current `RequestConfig` differs from its stored parent. Compare request data only, never transient UI state.

## 8. Request Builder

### Methods
Support exactly:
- `GET`
- `POST`
- `PUT`
- `PATCH`
- `DELETE`

### URL validation
Before sending:
- URL cannot be empty.
- URL must be an absolute `http://` or `https://` URL.
- Validate with the browser `URL` constructor.
- On failure, show an inline actionable error and do not send.

### Params and URL: two-way synchronization

The Params section is the primary clean key/value editor.

Normal behavior:
- Editable URL displays a normalized base endpoint, for example:
  `https://api.example.com/users`
- Params rows own query values, for example:
  `page=2`, `limit=20`
- Compute final outgoing URL:
  `https://api.example.com/users?page=2&limit=20`
- Show final URL as a read-only, copyable preview.

When user pastes/types a full URL with query values:
1. Parse query values into Params rows.
2. Normalize editable URL to the base endpoint without query.
3. Preserve duplicate keys and empty values where possible.
4. Never silently discard values.

Params:
- add/edit/delete rows,
- enable/disable rows,
- enabled rows update final URL immediately,
- disabled rows are excluded,
- keep at least one friendly empty row.

### Headers
- Add/edit/delete key/value rows.
- Enable/disable rows.
- Send only enabled rows.
- Keep an empty row available.
- Browser header normalization/combining is acceptable; do not simulate impossible browser behavior.

### Body editor
Provide modes:
- `None`
- `Raw`
- `JSON`

For JSON mode:
- Validate JSON before sending.
- Block invalid JSON with clear feedback.
- Provide `Format JSON`.
- Automatically send `Content-Type: application/json` only when the user has no enabled Content-Type header.
- Never overwrite user-supplied Content-Type.

Do not disable body editing based on method. However browser `fetch` cannot send GET with a body:
- If GET and body content is non-empty, block the send.
- Show a clear message: `GET requests cannot be sent with a body in the browser.`
- Do not silently strip the body.
- Record the blocked attempt in History.

### Clear
Clear/reset must:
- reset method to GET,
- clear URL,
- reset Params and Headers to clean editable rows,
- reset body to `none` and empty content,
- clear response and error,
- preserve tab identity,
- preserve `linkedSavedRequestId` if present.

## 9. Sending Requests and Errors

Use browser-native `fetch`.

Before sending:
1. Validate base URL.
2. Build final URL from base URL + enabled Params.
3. Validate JSON in JSON mode.
4. Block GET with body.
5. Build enabled headers.
6. Build request body according to mode.
7. Set loading only on the relevant tab and prevent duplicate sends there.

Implementation:
- Measure duration using `performance.now()`.
- Read response text exactly once.
- Attempt JSON parse when Content-Type suggests JSON or text parses as JSON.
- Treat HTTP 4xx/5xx as valid HTTP responses: show status/body; do not label as network failures.
- Record every attempt in History.

For rejected `fetch`:
- Explain honestly that browser failure can be network, unreachable API, or CORS.
- Do not claim certainty about exact CORS cause.
- Use a message such as:
  `The browser could not complete this request. The API may be unreachable, blocked by CORS, or the network may be unavailable.`
- Provide technical detail in a collapsible/details area if useful.
- Record the failed attempt in History.


## 10. Response Viewer

Show response data only for the active tab.

Show:
- status code and status text,
- request duration,
- response size,
- distinct success / client-error / server-error visual states.

Example: `200 OK · 183 ms · 2.4 KB`

Provide response sub-tabs:
- `Body`
- `Headers`
- `Raw`

Body:
- Pretty-render valid JSON.
- Fall back to readable text.
- Provide Pretty/Raw toggle for JSON.
- Provide copy button.
- Provide line-wrap toggle.
- Provide response font sizes: Small / Medium / Large.

Headers:
- Render response headers as readable key/value list or table.
- Include copy action if practical.

Raw:
- Show exact raw response text.
- Include copy action.

Also provide:
- Copy final URL.
- Copy response body.
- Generate/copy a cURL command with method, final URL, enabled headers, and body where applicable.

## 11. Collections and Saved Requests

Collections support:
- create,
- rename,
- delete with confirmation,
- collapse/expand,
- export one collection,
- import one collection.

Deleting a collection removes all saved requests inside it after confirmation.

### Default collection rules
Initial default is `Saved Requests`.

Default status is identified by `defaultCollectionId`, not its display name.
- It may be renamed and remains default.
- If default collection is deleted while other collections remain, choose one remaining collection as the new default.
- Only when the final remaining collection is deleted, create a fresh empty `Saved Requests` collection and make it default.

### Saving new request
Do not force a naming or collection dialog for normal saves.

For an unsaved tab:
- `Save` stores immediately in the default collection.
- Generate a full local timestamp name:
  `Request — YYYY-MM-DD HH:mm:ss`
  Example: `Request — 2026-06-21 14:32:09`
- On collision in the target collection, append ` - 2`, ` - 3`, etc.
- Link current tab to the created saved request.

### Saving linked request
For a linked tab:
- `Save` updates the parent saved request config and `updatedAt`, without dialog.
- Provide overflow/dropdown action: `Save as new request`.
- Save as new creates a timestamp-named request in the default collection and links current tab to that new request.

Saved requests support:
- rename,
- move to another collection,
- delete with confirmation,
- open in new tab,
- linked-tab updates above.

## 12. History

- Keep only newest **50** entries.
- Record every attempt: 2xx, 4xx, 5xx, invalid URL, invalid JSON, blocked GET-with-body, network/CORS failure.
- Each entry stores request snapshot, final URL where known, timestamp, status/status text if any, duration if any, and error info if any.
- Opening a History item creates an independent new tab:
  - copy request config,
  - no saved-request link,
  - do not restore old response.
- Deleting one History item requires no confirmation.
- Clearing all History requires confirmation.
- History section can collapse/expand.

## 13. Import / Export

The assignment requires Collections import/export. Implement both individual and bulk workflows.

### Export
- Individual: export one collection plus its saved requests.
  Suggested filename: `collection-<safe-name>-<timestamp>.json`
- Bulk: export all collections and all saved requests.
  Suggested filename: `collections-backup-<timestamp>.json`

### Import
Imports **add** collections. They never replace existing collections, history, tabs, theme, or settings.

Before import:
1. Read selected file.
2. Parse JSON.
3. Validate schema/version sufficiently to avoid corrupting app state.
4. Ask confirmation and describe what will be added.
5. Import only after confirmation.

Single import adds one collection. Bulk import adds all collections.

During import:
- Regenerate collection IDs and saved-request IDs.
- Do not trust imported IDs.
- If an imported collection name conflicts, suffix full date/time down to seconds:
  `Users API (Imported 2026-06-21 14-32-09)`
- If still conflicting, append numeric suffix:
  `Users API (Imported 2026-06-21 14-32-09 - 2)`
- Never overwrite existing collections.


## 14. Theme, Responsiveness, and Accessibility

- Visible light/dark toggle; persist user choice.
- Use CSS variables/tokens for coherent themes.
- Use system theme only as first-run fallback; saved preference wins afterwards.
- Desktop has persistent left sidebar; mobile uses accessible drawer.
- Use semantic buttons/inputs/selects/textareas, labels, visible focus rings, and accessible icon-button names/tooltips.
- Confirmation dialogs should close with Escape where safe and manage focus reasonably.

## 15. Code-Quality Rules

Use practical SOLID separation:
- `requestService`: validate/build/send requests and parse responses.
- `storageService`: read/write/hydrate/version persisted state.
- `importExportService`: serialize, validate, download, and import collection files.
- URL/query utilities: parse/build/normalize URLs.
- JSON utilities: validate/format.
- `KeyValueEditor` must be reused for Params and Headers.
- Reuse modal/confirmation/toast infrastructure.

Do not over-abstract tiny one-off visual components. Correct working behavior is more important than ceremonial architecture.

## 16. Manual Verification Checklist

Before declaring completion, verify:

### App shell
- [ ] Vite starts and TypeScript builds without errors.
- [ ] No normal console errors.
- [ ] Dark mode works and persists.
- [ ] Desktop sidebar works.
- [ ] Mobile sidebar drawer works.
- [ ] Narrow layout is usable.

### Tabs
- [ ] Starts with one blank tab.
- [ ] New, rename, close, last-tab behavior, duplicate all work.
- [ ] Tabs and active tab persist after reload.
- [ ] Response/error/loading do not persist after reload.

### Request builder
- [ ] Invalid/missing URL blocks sending clearly.
- [ ] Valid HTTP/HTTPS URL works.
- [ ] Params CRUD works.
- [ ] Headers CRUD works.
- [ ] URL query parsing and normalized base URL work.
- [ ] Params update final URL preview.
- [ ] Duplicate query keys survive.
- [ ] Raw body works.
- [ ] JSON validation and Format JSON work.
- [ ] JSON Content-Type behavior is correct.
- [ ] GET body blocks explicitly and enters History.
- [ ] Clear resets request but preserves saved-request link.

### Response/errors
- [ ] Loading appears.
- [ ] Success shows status/duration/size/body.
- [ ] 4xx/5xx show correctly without false network error.
- [ ] Network/CORS failure feedback is helpful.
- [ ] Body/Headers/Raw work.
- [ ] Pretty/raw, wrapping, font size, and copy actions work.
- [ ] cURL copy works.

### Collections/history
- [ ] Default collection exists.
- [ ] Unsaved Save creates timestamp name.
- [ ] Opening saved request creates linked tab.
- [ ] Save updates parent.
- [ ] Save as new works.
- [ ] Dirty indicator works.
- [ ] Rename/move/delete saved requests work.
- [ ] Collection CRUD and default reassignment work.
- [ ] Deleting final collection recreates Saved Requests.
- [ ] Every send attempt enters History.
- [ ] History cap is 50.
- [ ] Reopen history creates independent tab.
- [ ] History delete/clear confirmations follow specification.

### Import/export
- [ ] Individual export works.
- [ ] Bulk export works.
- [ ] Single/bulk imports validate and confirm.
- [ ] Imports add rather than replace.
- [ ] IDs regenerate.
- [ ] Name conflict suffix works.
- [ ] Invalid files cannot corrupt current state.

## 17. Completion Instructions

When finished:
1. Run the app.
2. Fix TypeScript, build, and runtime errors.
3. Execute the verification checklist in a local browser where possible.
4. Do not remove requirements because a public API is blocked by browser CORS.
5. Report:
   - files created/changed,
   - key architecture choices,
   - what was actually tested,
   - browser-only limitations encountered.
6. Never claim a feature was tested unless it was verified in code or in a local browser.

Build the complete project, not a partial mock-up.
