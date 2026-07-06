import type { AppState, Collection, HttpMethod, RequestConfig, RequestTab, ThemePreference } from "./types";
import { nowIso } from "../utils/dates";
import { newId } from "../utils/id";
import { createEmptyRow } from "../utils/requestConfig";

export const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];
export const DEFAULT_COLLECTION_NAME = "Saved Requests";
export const UNTITLED_REQUEST_TITLE = "Untitled Request";

export function createBlankRequest(): RequestConfig {
  return {
    method: "GET",
    baseUrl: "",
    params: [createEmptyRow()],
    headers: [createEmptyRow()],
    body: {
      mode: "none",
      content: "",
    },
  };
}

export function createBlankTab(): RequestTab {
  return {
    id: newId("tab"),
    title: UNTITLED_REQUEST_TITLE,
    request: createBlankRequest(),
    linkedSavedRequestId: null,
    sentRequest: null,
    sentFinalUrl: null,
    response: null,
    error: null,
    isLoading: false,
  };
}

export function createDefaultCollection(): Collection {
  const timestamp = nowIso();
  return {
    id: newId("collection"),
    name: DEFAULT_COLLECTION_NAME,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function getSystemTheme(): ThemePreference {
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

export function createInitialState(theme: ThemePreference = getSystemTheme()): AppState {
  const defaultCollection = createDefaultCollection();
  const firstTab = createBlankTab();

  return {
    collections: [defaultCollection],
    savedRequests: [],
    tabs: [firstTab],
    activeTabId: firstTab.id,
    history: [],
    defaultCollectionId: defaultCollection.id,
    theme,
    collapsedCollectionIds: [],
    isHistoryCollapsed: false,
  };
}

export function withValidActiveTab(state: AppState): AppState {
  const firstTab = state.tabs[0] ?? createBlankTab();
  const tabs = state.tabs.length > 0 ? state.tabs : [firstTab];
  const activeTabId = tabs.some((tab) => tab.id === state.activeTabId) ? state.activeTabId : firstTab.id;

  return { ...state, tabs, activeTabId };
}
