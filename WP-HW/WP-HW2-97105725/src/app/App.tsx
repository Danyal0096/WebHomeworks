import { useEffect, useReducer, useRef, useState } from "react";
import type { HistoryEntry, RequestConfig, RequestTab } from "./types";
import { appReducer } from "./reducer";
import { consumeStorageMessage, loadState, saveState } from "../services/storageService";
import { prepareRequest, sendPreparedRequest, sendRequest } from "../services/requestService";
import { normalizeRequestConfig } from "../utils/requestConfig";
import { newId } from "../utils/id";
import { nowIso } from "../utils/dates";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { Button } from "../components/common/Button";
import { ToastProvider, useToast } from "../components/common/Toast";
import { Sidebar } from "../components/layout/Sidebar";
import { RequestBuilder } from "../components/request/RequestBuilder";
import { ResponseViewer } from "../components/response/ResponseViewer";
import { TabBar } from "../components/tabs/TabBar";

function historyFromResult(request: RequestConfig, result: Awaited<ReturnType<typeof sendRequest>>): HistoryEntry {
  if (result.kind === "response") {
    return {
      id: newId("history"),
      request: normalizeRequestConfig(request),
      finalUrl: result.finalUrl,
      timestamp: nowIso(),
      status: result.response.status,
      statusText: result.response.statusText,
      durationMs: result.response.durationMs,
      errorKind: null,
      errorMessage: null,
    };
  }

  return {
    id: newId("history"),
    request: normalizeRequestConfig(request),
    finalUrl: result.finalUrl,
    timestamp: nowIso(),
    status: null,
    statusText: null,
    durationMs: result.durationMs,
    errorKind: result.error.kind,
    errorMessage: result.error.message,
  };
}

function getActiveTab(tabs: RequestTab[], activeTabId: string): RequestTab {
  return tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
}

function AppShell() {
  const [state, dispatch] = useReducer(appReducer, undefined, loadState);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const sendingTabIdsRef = useRef<Set<string>>(new Set());
  const lastStorageToastRef = useRef<string | null>(null);
  const isMobile = useMediaQuery("(max-width: 820px)");
  const { showToast } = useToast();
  const activeTab = getActiveTab(state.tabs, state.activeTabId);
  const isLinked = Boolean(activeTab.linkedSavedRequestId);

  useEffect(() => {
    const storageError = saveState(state);
    if (storageError && storageError !== lastStorageToastRef.current) {
      lastStorageToastRef.current = storageError;
      showToast(storageError, "error");
    }
    document.documentElement.dataset.theme = state.theme;
  }, [showToast, state]);

  useEffect(() => {
    const storageMessage = consumeStorageMessage();
    if (storageMessage && storageMessage !== lastStorageToastRef.current) {
      lastStorageToastRef.current = storageMessage;
      showToast(storageMessage, "error");
    }
  }, [showToast]);

  useEffect(() => {
    if (!isMobile) {
      setIsDrawerOpen(false);
    }
  }, [isMobile]);

  const handleSend = async () => {
    const tab = getActiveTab(state.tabs, state.activeTabId);
    if (tab.isLoading || sendingTabIdsRef.current.has(tab.id)) {
      showToast("This tab is already sending a request.", "info");
      return;
    }

    sendingTabIdsRef.current.add(tab.id);
    const requestSnapshot = normalizeRequestConfig(tab.request);
    const prepared = prepareRequest(requestSnapshot);

    try {
      if ("error" in prepared) {
        const result = {
          kind: "error" as const,
          finalUrl: prepared.finalUrl,
          error: prepared.error,
          durationMs: null,
        };
        dispatch({ type: "add-history-entry", entry: historyFromResult(requestSnapshot, result) });
        dispatch({
          type: "set-tab-error",
          tabId: tab.id,
          error: prepared.error,
          request: requestSnapshot,
          finalUrl: prepared.finalUrl,
        });
        showToast(prepared.error.message, prepared.error.kind === "validation" ? "info" : "error");
        return;
      }

      dispatch({
        type: "set-tab-loading",
        tabId: tab.id,
        request: requestSnapshot,
        finalUrl: prepared.finalUrl,
      });

      const result = await sendPreparedRequest(requestSnapshot, prepared);
      dispatch({ type: "add-history-entry", entry: historyFromResult(requestSnapshot, result) });

      if (result.kind === "response") {
        dispatch({ type: "set-tab-response", tabId: tab.id, response: result.response });
        showToast(`Received ${result.response.status} ${result.response.statusText}.`, "success");
        return;
      }

      dispatch({
        type: "set-tab-error",
        tabId: tab.id,
        error: result.error,
        request: requestSnapshot,
        finalUrl: result.finalUrl,
      });
      showToast(result.error.message, result.error.kind === "validation" ? "info" : "error");
    } finally {
      sendingTabIdsRef.current.delete(tab.id);
    }
  };

  const closeDrawerAfterNavigate = () => {
    if (isMobile) {
      setIsDrawerOpen(false);
    }
  };

  return (
    <div className={`app-shell ${isDrawerOpen ? "drawer-open" : ""}`}>
      {isMobile ? (
        <div className="mobile-topbar">
          <Button
            aria-controls="mobile-sidebar"
            aria-expanded={isDrawerOpen}
            aria-label="Open sidebar menu"
            onClick={() => setIsDrawerOpen(true)}
            variant="secondary"
          >
            <span aria-hidden="true" className="hamburger-icon">
              <span />
              <span />
              <span />
            </span>
            Menu
          </Button>
          <span>HTTP Workspace</span>
        </div>
      ) : null}

      {isMobile && isDrawerOpen ? (
        <button aria-label="Close sidebar overlay" className="drawer-backdrop" onClick={() => setIsDrawerOpen(false)} type="button" />
      ) : null}

      <div
        className={`sidebar-shell ${isMobile ? "drawer" : ""} ${isDrawerOpen ? "open" : ""}`}
        id="mobile-sidebar"
      >
        {isMobile ? (
          <div className="drawer-close-row">
            <Button onClick={() => setIsDrawerOpen(false)} size="sm" variant="secondary">
              Close
            </Button>
          </div>
        ) : null}
        <Sidebar
          collapsedCollectionIds={state.collapsedCollectionIds}
          collections={state.collections}
          defaultCollectionId={state.defaultCollectionId}
          history={state.history}
          isHistoryCollapsed={state.isHistoryCollapsed}
          onAfterNavigate={closeDrawerAfterNavigate}
          onClearHistory={() => dispatch({ type: "clear-history" })}
          onCreateCollection={(name) => {
            dispatch({ type: "create-collection", name });
            showToast("Collection created.", "success");
          }}
          onDeleteCollection={(collectionId) => {
            dispatch({ type: "delete-collection", collectionId });
            showToast("Collection deleted.", "success");
          }}
          onDeleteHistoryEntry={(historyEntryId) => dispatch({ type: "delete-history-entry", historyEntryId })}
          onDeleteSavedRequest={(savedRequestId) => {
            dispatch({ type: "delete-saved-request", savedRequestId });
            showToast("Saved request deleted.", "success");
          }}
          onImportMaterialized={(collections, savedRequests) =>
            dispatch({ type: "import-materialized", collections, savedRequests })
          }
          onMoveSavedRequest={(savedRequestId, collectionId) => {
            dispatch({ type: "move-saved-request", savedRequestId, collectionId });
            showToast("Saved request moved.", "success");
          }}
          onOpenHistoryEntry={(historyEntryId) => dispatch({ type: "open-history-entry", historyEntryId })}
          onOpenSavedRequest={(savedRequestId) => dispatch({ type: "open-saved-request", savedRequestId })}
          onRenameCollection={(collectionId, name) => {
            dispatch({ type: "rename-collection", collectionId, name });
            showToast("Collection renamed.", "success");
          }}
          onRenameSavedRequest={(savedRequestId, name) => {
            dispatch({ type: "rename-saved-request", savedRequestId, name });
            showToast("Saved request renamed.", "success");
          }}
          onThemeChange={(theme) => dispatch({ type: "set-theme", theme })}
          onToggleCollection={(collectionId) => dispatch({ type: "toggle-collection", collectionId })}
          onToggleHistory={() => dispatch({ type: "toggle-history" })}
          savedRequests={state.savedRequests}
          theme={state.theme}
        />
      </div>

      <main className="workspace">
        <TabBar
          activeTabId={state.activeTabId}
          onClose={(tabId) => dispatch({ type: "close-tab", tabId })}
          onDuplicate={() => dispatch({ type: "duplicate-active-tab" })}
          onNew={() => dispatch({ type: "add-tab" })}
          onRename={(tabId, title) => dispatch({ type: "rename-tab", tabId, title })}
          onSelect={(tabId) => dispatch({ type: "select-tab", tabId })}
          savedRequests={state.savedRequests}
          tabs={state.tabs}
        />

        <div className="workspace-content">
          <RequestBuilder
            error={activeTab.error}
            isLinked={isLinked}
            isLoading={activeTab.isLoading}
            onChange={(request) => dispatch({ type: "replace-active-request", request })}
            onClear={() => {
              dispatch({ type: "clear-active-tab" });
              showToast("Request cleared.", "info");
            }}
            onSave={() => {
              dispatch({ type: "save-active-request" });
              showToast("Request saved.", "success");
            }}
            onSaveAsNew={() => {
              dispatch({ type: "save-active-as-new" });
              showToast("Request saved as new.", "success");
            }}
            onSend={() => {
              void handleSend();
            }}
            request={activeTab.request}
          />

          <ResponseViewer
            error={activeTab.error}
            isLoading={activeTab.isLoading}
            request={activeTab.request}
            response={activeTab.response}
            sentFinalUrl={activeTab.sentFinalUrl}
            sentRequest={activeTab.sentRequest}
          />
        </div>
      </main>
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AppShell />
    </ToastProvider>
  );
}
