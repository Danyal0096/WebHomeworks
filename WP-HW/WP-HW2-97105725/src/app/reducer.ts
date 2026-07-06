import type {
  AppState,
  Collection,
  HistoryEntry,
  RequestConfig,
  RequestErrorState,
  RequestTab,
  ResponseSnapshot,
  SavedRequest,
  ThemePreference,
} from "./types";
import { createBlankRequest, createBlankTab, createDefaultCollection } from "./defaults";
import { formatLocalDateTime, nowIso } from "../utils/dates";
import { newId } from "../utils/id";
import { cloneRequestConfig, ensureEditableRows, normalizeRequestConfig } from "../utils/requestConfig";

export type AppAction =
  | { type: "set-theme"; theme: ThemePreference }
  | { type: "select-tab"; tabId: string }
  | { type: "add-tab" }
  | { type: "close-tab"; tabId: string }
  | { type: "rename-tab"; tabId: string; title: string }
  | { type: "duplicate-active-tab" }
  | { type: "replace-active-request"; request: RequestConfig }
  | { type: "clear-active-tab" }
  | { type: "set-tab-loading"; tabId: string; request: RequestConfig; finalUrl: string }
  | { type: "set-tab-response"; tabId: string; response: ResponseSnapshot }
  | { type: "set-tab-error"; tabId: string; error: RequestErrorState; request?: RequestConfig; finalUrl?: string }
  | { type: "open-saved-request"; savedRequestId: string }
  | { type: "open-history-entry"; historyEntryId: string }
  | { type: "save-active-request" }
  | { type: "save-active-as-new" }
  | { type: "create-collection"; name: string }
  | { type: "rename-collection"; collectionId: string; name: string }
  | { type: "delete-collection"; collectionId: string }
  | { type: "toggle-collection"; collectionId: string }
  | { type: "rename-saved-request"; savedRequestId: string; name: string }
  | { type: "move-saved-request"; savedRequestId: string; collectionId: string }
  | { type: "delete-saved-request"; savedRequestId: string }
  | { type: "add-history-entry"; entry: HistoryEntry }
  | { type: "delete-history-entry"; historyEntryId: string }
  | { type: "clear-history" }
  | { type: "toggle-history" }
  | { type: "import-materialized"; collections: Collection[]; savedRequests: SavedRequest[] };

function activeTab(state: AppState): RequestTab {
  return state.tabs.find((tab) => tab.id === state.activeTabId) ?? state.tabs[0];
}

function updateTab(state: AppState, tabId: string, updater: (tab: RequestTab) => RequestTab): AppState {
  return {
    ...state,
    tabs: state.tabs.map((tab) => (tab.id === tabId ? updater(tab) : tab)),
  };
}

function ensureDefaultCollection(state: AppState): AppState {
  if (state.collections.length > 0 && state.collections.some((collection) => collection.id === state.defaultCollectionId)) {
    return state;
  }

  if (state.collections.length > 0) {
    return { ...state, defaultCollectionId: state.collections[0].id };
  }

  const collection = createDefaultCollection();
  return {
    ...state,
    collections: [collection],
    defaultCollectionId: collection.id,
  };
}

function timestampRequestName(savedRequests: SavedRequest[], collectionId: string): string {
  const baseName = `Request \u2014 ${formatLocalDateTime()}`;
  const usedNames = new Set(
    savedRequests.filter((saved) => saved.collectionId === collectionId).map((saved) => saved.name),
  );

  if (!usedNames.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  let candidate = `${baseName} - ${suffix}`;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `${baseName} - ${suffix}`;
  }

  return candidate;
}

function createSavedFromTab(state: AppState, tab: RequestTab): { saved: SavedRequest; tab: RequestTab } {
  const timestamp = nowIso();
  const defaulted = ensureDefaultCollection(state);
  const collectionId = defaulted.defaultCollectionId;
  const name = timestampRequestName(defaulted.savedRequests, collectionId);
  const saved: SavedRequest = {
    id: newId("saved"),
    name,
    collectionId,
    request: normalizeRequestConfig(tab.request),
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    saved,
    tab: {
      ...tab,
      title: name,
      linkedSavedRequestId: saved.id,
    },
  };
}

function withoutSavedLinks(tabs: RequestTab[], removedIds: Set<string>): RequestTab[] {
  return tabs.map((tab) =>
    tab.linkedSavedRequestId && removedIds.has(tab.linkedSavedRequestId)
      ? { ...tab, linkedSavedRequestId: null }
      : tab,
  );
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "set-theme":
      return { ...state, theme: action.theme };

    case "select-tab":
      return state.tabs.some((tab) => tab.id === action.tabId) ? { ...state, activeTabId: action.tabId } : state;

    case "add-tab": {
      const tab = createBlankTab();
      return {
        ...state,
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      };
    }

    case "close-tab": {
      const nextTabs = state.tabs.filter((tab) => tab.id !== action.tabId);
      if (nextTabs.length === 0) {
        const tab = createBlankTab();
        return { ...state, tabs: [tab], activeTabId: tab.id };
      }

      const activeTabId =
        state.activeTabId === action.tabId ? nextTabs[Math.max(0, state.tabs.findIndex((tab) => tab.id === action.tabId) - 1)].id : state.activeTabId;

      return { ...state, tabs: nextTabs, activeTabId };
    }

    case "rename-tab":
      return updateTab(state, action.tabId, (tab) => ({
        ...tab,
        title: action.title.trim() || tab.title,
      }));

    case "duplicate-active-tab": {
      const source = activeTab(state);
      const tab: RequestTab = {
        ...createBlankTab(),
        title: `${source.title} Copy`,
        request: cloneRequestConfig(source.request),
        linkedSavedRequestId: null,
      };

      return {
        ...state,
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      };
    }

    case "replace-active-request":
      return updateTab(state, state.activeTabId, (tab) => ({
        ...tab,
        request: {
          ...action.request,
          params: ensureEditableRows(action.request.params),
          headers: ensureEditableRows(action.request.headers),
        },
        sentRequest: tab.isLoading ? tab.sentRequest : null,
        sentFinalUrl: tab.isLoading ? tab.sentFinalUrl : null,
        response: tab.isLoading ? tab.response : null,
        error: tab.isLoading ? tab.error : null,
      }));

    case "clear-active-tab":
      return updateTab(state, state.activeTabId, (tab) => ({
        ...tab,
        request: createBlankRequest(),
        sentRequest: null,
        sentFinalUrl: null,
        response: null,
        error: null,
        isLoading: false,
      }));

    case "set-tab-loading":
      return updateTab(state, action.tabId, (tab) => ({
        ...tab,
        isLoading: true,
        sentRequest: cloneRequestConfig(action.request),
        sentFinalUrl: action.finalUrl,
        response: null,
        error: null,
      }));

    case "set-tab-response":
      return updateTab(state, action.tabId, (tab) => ({
        ...tab,
        isLoading: false,
        sentRequest: cloneRequestConfig(action.response.request),
        sentFinalUrl: action.response.finalUrl,
        response: action.response,
        error: null,
      }));

    case "set-tab-error":
      return updateTab(state, action.tabId, (tab) => ({
        ...tab,
        isLoading: false,
        sentRequest: action.request ? cloneRequestConfig(action.request) : tab.sentRequest,
        sentFinalUrl: action.finalUrl ?? tab.sentFinalUrl,
        response: null,
        error: action.error,
      }));

    case "open-saved-request": {
      const saved = state.savedRequests.find((item) => item.id === action.savedRequestId);
      if (!saved) {
        return state;
      }

      const tab: RequestTab = {
        ...createBlankTab(),
        title: saved.name,
        request: cloneRequestConfig(saved.request),
        linkedSavedRequestId: saved.id,
      };

      return {
        ...state,
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      };
    }

    case "open-history-entry": {
      const history = state.history.find((entry) => entry.id === action.historyEntryId);
      if (!history) {
        return state;
      }

      const tab: RequestTab = {
        ...createBlankTab(),
        title: history.request.baseUrl || "History Request",
        request: cloneRequestConfig(history.request),
        linkedSavedRequestId: null,
      };

      return {
        ...state,
        tabs: [...state.tabs, tab],
        activeTabId: tab.id,
      };
    }

    case "save-active-request": {
      const defaulted = ensureDefaultCollection(state);
      const tab = activeTab(defaulted);
      const existing = tab.linkedSavedRequestId
        ? defaulted.savedRequests.find((saved) => saved.id === tab.linkedSavedRequestId)
        : null;

      if (existing) {
        const timestamp = nowIso();
        return {
          ...defaulted,
          savedRequests: defaulted.savedRequests.map((saved) =>
            saved.id === existing.id
              ? {
                  ...saved,
                  request: normalizeRequestConfig(tab.request),
                  updatedAt: timestamp,
                }
              : saved,
          ),
        };
      }

      const created = createSavedFromTab(defaulted, tab);
      return {
        ...defaulted,
        savedRequests: [...defaulted.savedRequests, created.saved],
        tabs: defaulted.tabs.map((item) => (item.id === tab.id ? created.tab : item)),
      };
    }

    case "save-active-as-new": {
      const defaulted = ensureDefaultCollection(state);
      const tab = activeTab(defaulted);
      const created = createSavedFromTab(defaulted, tab);

      return {
        ...defaulted,
        savedRequests: [...defaulted.savedRequests, created.saved],
        tabs: defaulted.tabs.map((item) => (item.id === tab.id ? created.tab : item)),
      };
    }

    case "create-collection": {
      const timestamp = nowIso();
      const name = action.name.trim();
      if (!name) {
        return state;
      }

      return {
        ...state,
        collections: [
          ...state.collections,
          {
            id: newId("collection"),
            name,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      };
    }

    case "rename-collection": {
      const name = action.name.trim();
      if (!name) {
        return state;
      }

      return {
        ...state,
        collections: state.collections.map((collection) =>
          collection.id === action.collectionId ? { ...collection, name, updatedAt: nowIso() } : collection,
        ),
      };
    }

    case "delete-collection": {
      const removedSavedIds = new Set(
        state.savedRequests.filter((saved) => saved.collectionId === action.collectionId).map((saved) => saved.id),
      );
      const collections = state.collections.filter((collection) => collection.id !== action.collectionId);
      const savedRequests = state.savedRequests.filter((saved) => saved.collectionId !== action.collectionId);
      const nextState = ensureDefaultCollection({
        ...state,
        collections,
        savedRequests,
        tabs: withoutSavedLinks(state.tabs, removedSavedIds),
        collapsedCollectionIds: state.collapsedCollectionIds.filter((id) => id !== action.collectionId),
        defaultCollectionId: state.defaultCollectionId === action.collectionId ? "" : state.defaultCollectionId,
      });

      return {
        ...nextState,
        defaultCollectionId: nextState.collections.length === 1 ? nextState.collections[0].id : nextState.defaultCollectionId,
      };
    }

    case "toggle-collection": {
      const isCollapsed = state.collapsedCollectionIds.includes(action.collectionId);
      return {
        ...state,
        collapsedCollectionIds: isCollapsed
          ? state.collapsedCollectionIds.filter((id) => id !== action.collectionId)
          : [...state.collapsedCollectionIds, action.collectionId],
      };
    }

    case "rename-saved-request": {
      const name = action.name.trim();
      if (!name) {
        return state;
      }

      return {
        ...state,
        savedRequests: state.savedRequests.map((saved) =>
          saved.id === action.savedRequestId ? { ...saved, name, updatedAt: nowIso() } : saved,
        ),
        tabs: state.tabs.map((tab) =>
          tab.linkedSavedRequestId === action.savedRequestId ? { ...tab, title: name } : tab,
        ),
      };
    }

    case "move-saved-request": {
      if (!state.collections.some((collection) => collection.id === action.collectionId)) {
        return state;
      }

      return {
        ...state,
        savedRequests: state.savedRequests.map((saved) =>
          saved.id === action.savedRequestId
            ? { ...saved, collectionId: action.collectionId, updatedAt: nowIso() }
            : saved,
        ),
      };
    }

    case "delete-saved-request": {
      const removed = new Set([action.savedRequestId]);
      return {
        ...state,
        savedRequests: state.savedRequests.filter((saved) => saved.id !== action.savedRequestId),
        tabs: withoutSavedLinks(state.tabs, removed),
      };
    }

    case "add-history-entry":
      return {
        ...state,
        history: [action.entry, ...state.history].slice(0, 50),
      };

    case "delete-history-entry":
      return {
        ...state,
        history: state.history.filter((entry) => entry.id !== action.historyEntryId),
      };

    case "clear-history":
      return { ...state, history: [] };

    case "toggle-history":
      return { ...state, isHistoryCollapsed: !state.isHistoryCollapsed };

    case "import-materialized":
      return {
        ...state,
        collections: [...state.collections, ...action.collections],
        savedRequests: [...state.savedRequests, ...action.savedRequests],
      };

    default:
      return state;
  }
}
