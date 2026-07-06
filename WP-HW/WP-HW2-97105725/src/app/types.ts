export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type BodyMode = "none" | "raw" | "json";
export type ThemePreference = "light" | "dark";

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
  isJson: boolean;
  contentType: string | null;
  durationMs: number;
  sizeBytes: number;
  finalUrl: string;
  request: RequestConfig;
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
  sentRequest: RequestConfig | null;
  sentFinalUrl: string | null;
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

export interface AppState {
  collections: Collection[];
  savedRequests: SavedRequest[];
  tabs: RequestTab[];
  activeTabId: string;
  history: HistoryEntry[];
  defaultCollectionId: string;
  theme: ThemePreference;
  collapsedCollectionIds: string[];
  isHistoryCollapsed: boolean;
}

export interface ImportCollectionPayload {
  name: string;
  savedRequests: Array<{
    name: string;
    request: RequestConfig;
    createdAt?: string;
    updatedAt?: string;
  }>;
}

export interface ValidImportPayload {
  mode: "single" | "bulk";
  collections: ImportCollectionPayload[];
}
