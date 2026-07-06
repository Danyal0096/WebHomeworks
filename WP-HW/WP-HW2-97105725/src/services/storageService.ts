import type {
  AppState,
  BodyMode,
  HttpMethod,
  KeyValueRow,
  RequestConfig,
  RequestErrorState,
  RequestTab,
  ThemePreference,
} from "../app/types";
import { createDefaultCollection, createInitialState, withValidActiveTab } from "../app/defaults";
import { normalizeRequestConfig } from "../utils/requestConfig";
import { newId } from "../utils/id";

const STORAGE_KEY = "wp-hw2-postman-clone-state-v1";
const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const BODY_MODES: BodyMode[] = ["none", "raw", "json"];
const ERROR_KINDS: RequestErrorState["kind"][] = [
  "validation",
  "json",
  "network",
  "cors",
  "unsupported-body",
  "unknown",
];
let pendingStorageMessage: string | null = null;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isKeyValueRow(value: unknown): value is KeyValueRow {
  return (
    isObject(value) &&
    typeof value.id === "string" &&
    typeof value.key === "string" &&
    typeof value.value === "string" &&
    typeof value.enabled === "boolean"
  );
}

export function isRequestConfig(value: unknown): value is RequestConfig {
  if (!isObject(value) || !METHODS.includes(value.method as HttpMethod)) {
    return false;
  }

  const body = value.body;
  return (
    typeof value.baseUrl === "string" &&
    Array.isArray(value.params) &&
    value.params.every(isKeyValueRow) &&
    Array.isArray(value.headers) &&
    value.headers.every(isKeyValueRow) &&
    isObject(body) &&
    BODY_MODES.includes(body.mode as BodyMode) &&
    typeof body.content === "string"
  );
}

function isErrorKind(value: unknown): value is RequestErrorState["kind"] {
  return ERROR_KINDS.includes(value as RequestErrorState["kind"]);
}

function sanitizeTab(value: unknown): RequestTab | null {
  if (!isObject(value) || typeof value.id !== "string" || !isRequestConfig(value.request)) {
    return null;
  }

  return {
    id: value.id,
    title: typeof value.title === "string" ? value.title : "Untitled Request",
    request: normalizeRequestConfig(value.request),
    linkedSavedRequestId: typeof value.linkedSavedRequestId === "string" ? value.linkedSavedRequestId : null,
    sentRequest: null,
    sentFinalUrl: null,
    response: null,
    error: null,
    isLoading: false,
  };
}

export function loadState(): AppState {
  if (typeof localStorage === "undefined") {
    pendingStorageMessage = "Persistence is unavailable in this browser session.";
    return withValidActiveTab(createInitialState());
  }

  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    pendingStorageMessage =
      error instanceof Error
        ? `Saved data could not be read: ${error.message}`
        : "Saved data could not be read from localStorage.";
    return withValidActiveTab(createInitialState());
  }

  if (!raw) {
    return withValidActiveTab(createInitialState());
  }

  try {
    const parsed = JSON.parse(raw);
    if (!isObject(parsed) || parsed.version !== 1) {
      return withValidActiveTab(createInitialState());
    }

    const fallback = createInitialState();
    const collections = Array.isArray(parsed.collections)
      ? parsed.collections.filter(isObject).map((collection) => ({
          id: typeof collection.id === "string" ? collection.id : newId("collection"),
          name: typeof collection.name === "string" ? collection.name : "Collection",
          createdAt: typeof collection.createdAt === "string" ? collection.createdAt : new Date().toISOString(),
          updatedAt: typeof collection.updatedAt === "string" ? collection.updatedAt : new Date().toISOString(),
        }))
      : fallback.collections;

    const ensuredCollections = collections.length > 0 ? collections : [createDefaultCollection()];
    const collectionIds = new Set(ensuredCollections.map((collection) => collection.id));

    const savedRequests = Array.isArray(parsed.savedRequests)
      ? parsed.savedRequests
          .filter(isObject)
          .filter((saved) => typeof saved.id === "string" && typeof saved.name === "string" && isRequestConfig(saved.request))
          .filter((saved) => collectionIds.has(String(saved.collectionId)))
          .map((saved) => ({
            id: String(saved.id),
            name: String(saved.name),
            collectionId: String(saved.collectionId),
            request: normalizeRequestConfig(saved.request as RequestConfig),
            createdAt: typeof saved.createdAt === "string" ? saved.createdAt : new Date().toISOString(),
            updatedAt: typeof saved.updatedAt === "string" ? saved.updatedAt : new Date().toISOString(),
          }))
      : [];

    const savedIds = new Set(savedRequests.map((saved) => saved.id));
    const tabs = Array.isArray(parsed.tabs)
      ? parsed.tabs
          .map(sanitizeTab)
          .filter((tab): tab is RequestTab => tab !== null)
          .map((tab) => ({
            ...tab,
            linkedSavedRequestId:
              tab.linkedSavedRequestId && savedIds.has(tab.linkedSavedRequestId) ? tab.linkedSavedRequestId : null,
          }))
      : fallback.tabs;

    const history = Array.isArray(parsed.history)
      ? parsed.history
          .filter(isObject)
          .filter((entry) => typeof entry.id === "string" && isRequestConfig(entry.request))
          .slice(0, 50)
          .map((entry) => ({
            id: String(entry.id),
            request: normalizeRequestConfig(entry.request as RequestConfig),
            finalUrl: typeof entry.finalUrl === "string" ? entry.finalUrl : "",
            timestamp: typeof entry.timestamp === "string" ? entry.timestamp : new Date().toISOString(),
            status: typeof entry.status === "number" ? entry.status : null,
            statusText: typeof entry.statusText === "string" ? entry.statusText : null,
            durationMs: typeof entry.durationMs === "number" ? entry.durationMs : null,
            errorKind: isErrorKind(entry.errorKind) ? entry.errorKind : null,
            errorMessage: typeof entry.errorMessage === "string" ? entry.errorMessage : null,
          }))
      : [];

    const defaultCollectionId =
      typeof parsed.defaultCollectionId === "string" && collectionIds.has(parsed.defaultCollectionId)
        ? parsed.defaultCollectionId
        : ensuredCollections[0].id;

    const state = withValidActiveTab({
      collections: ensuredCollections,
      savedRequests,
      tabs,
      activeTabId: typeof parsed.activeTabId === "string" ? parsed.activeTabId : "",
      history,
      defaultCollectionId,
      theme: parsed.theme === "dark" || parsed.theme === "light" ? (parsed.theme as ThemePreference) : fallback.theme,
      collapsedCollectionIds: Array.isArray(parsed.collapsedCollectionIds)
        ? parsed.collapsedCollectionIds.filter((id): id is string => typeof id === "string")
        : [],
      isHistoryCollapsed: Boolean(parsed.isHistoryCollapsed),
    });

    return state;
  } catch {
    pendingStorageMessage = "Saved data could not be loaded, so a fresh workspace was created.";
    return withValidActiveTab(createInitialState());
  }
}

export function saveState(state: AppState): string | null {
  if (typeof localStorage === "undefined") {
    return "Persistence is unavailable in this browser session.";
  }

  const persistable = {
    version: 1,
    collections: state.collections,
    savedRequests: state.savedRequests.map((saved) => ({
      ...saved,
      request: normalizeRequestConfig(saved.request),
    })),
    tabs: state.tabs.map((tab) => ({
      id: tab.id,
      title: tab.title,
      request: normalizeRequestConfig(tab.request),
      linkedSavedRequestId: tab.linkedSavedRequestId,
    })),
    activeTabId: state.activeTabId,
    history: state.history.slice(0, 50).map((entry) => ({
      ...entry,
      request: normalizeRequestConfig(entry.request),
    })),
    defaultCollectionId: state.defaultCollectionId,
    theme: state.theme,
    collapsedCollectionIds: state.collapsedCollectionIds,
    isHistoryCollapsed: state.isHistoryCollapsed,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(persistable));
    return null;
  } catch (error) {
    return error instanceof Error
      ? `Workspace changes could not be persisted: ${error.message}`
      : "Workspace changes could not be persisted to localStorage.";
  }
}

export function consumeStorageMessage(): string | null {
  const message = pendingStorageMessage;
  pendingStorageMessage = null;
  return message;
}
