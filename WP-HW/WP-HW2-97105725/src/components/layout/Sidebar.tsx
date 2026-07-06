import { useRef, useState } from "react";
import type { Collection, HistoryEntry, SavedRequest, ThemePreference, ValidImportPayload } from "../../app/types";
import { describeImport, materializeImport, buildBulkExport, buildCollectionExport, downloadJson, readJsonFile, validateImport } from "../../services/importExportService";
import { formatDisplayDate } from "../../utils/dates";
import { Button } from "../common/Button";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { EmptyState } from "../common/EmptyState";
import { Modal } from "../common/Modal";
import { useToast } from "../common/Toast";

interface SidebarProps {
  collections: Collection[];
  savedRequests: SavedRequest[];
  history: HistoryEntry[];
  defaultCollectionId: string;
  collapsedCollectionIds: string[];
  isHistoryCollapsed: boolean;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onCreateCollection: (name: string) => void;
  onRenameCollection: (collectionId: string, name: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onToggleCollection: (collectionId: string) => void;
  onOpenSavedRequest: (savedRequestId: string) => void;
  onRenameSavedRequest: (savedRequestId: string, name: string) => void;
  onMoveSavedRequest: (savedRequestId: string, collectionId: string) => void;
  onDeleteSavedRequest: (savedRequestId: string) => void;
  onOpenHistoryEntry: (historyEntryId: string) => void;
  onDeleteHistoryEntry: (historyEntryId: string) => void;
  onClearHistory: () => void;
  onToggleHistory: () => void;
  onImportMaterialized: (collections: Collection[], savedRequests: SavedRequest[]) => void;
  onAfterNavigate?: () => void;
}

interface NameDialogState {
  title: string;
  label: string;
  initialValue: string;
  onSubmit: (value: string) => void;
}

interface ConfirmState {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: "normal" | "danger";
  onConfirm: () => void;
}

interface PendingImport {
  payload: ValidImportPayload;
  description: string;
}

function requestCount(collectionId: string, savedRequests: SavedRequest[]): number {
  return savedRequests.filter((saved) => saved.collectionId === collectionId).length;
}

function trimUrl(url: string): string {
  return url || "(no URL)";
}

export function Sidebar({
  collections,
  savedRequests,
  history,
  defaultCollectionId,
  collapsedCollectionIds,
  isHistoryCollapsed,
  theme,
  onThemeChange,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onToggleCollection,
  onOpenSavedRequest,
  onRenameSavedRequest,
  onMoveSavedRequest,
  onDeleteSavedRequest,
  onOpenHistoryEntry,
  onDeleteHistoryEntry,
  onClearHistory,
  onToggleHistory,
  onImportMaterialized,
  onAfterNavigate,
}: SidebarProps) {
  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [movingRequest, setMovingRequest] = useState<SavedRequest | null>(null);
  const [moveTarget, setMoveTarget] = useState("");
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const singleImportRef = useRef<HTMLInputElement | null>(null);
  const bulkImportRef = useRef<HTMLInputElement | null>(null);
  const { showToast } = useToast();

  const openNameDialog = (dialog: NameDialogState) => {
    setNameDialog(dialog);
    setNameValue(dialog.initialValue);
  };

  const submitNameDialog = () => {
    if (!nameDialog) {
      return;
    }

    if (nameValue.trim() === "") {
      showToast("Name cannot be empty.", "error");
      return;
    }

    nameDialog.onSubmit(nameValue);
    setNameDialog(null);
  };

  const handleFileImport = async (file: File | undefined, expected: "single" | "bulk") => {
    if (!file) {
      return;
    }

    try {
      const parsed = await readJsonFile(file);
      const payload = validateImport(parsed, expected);
      setPendingImport({ payload, description: describeImport(payload) });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Import failed.", "error");
    }
  };

  const confirmImport = () => {
    if (!pendingImport) {
      return;
    }

    const materialized = materializeImport(pendingImport.payload, collections);
    onImportMaterialized(materialized.collections, materialized.savedRequests);
    setPendingImport(null);
    showToast("Import completed.", "success");
  };

  const exportCollection = (collection: Collection) => {
    const exported = buildCollectionExport(collection, savedRequests);
    downloadJson(exported.filename, exported.data);
    showToast("Collection export started.", "success");
  };

  const exportBulk = () => {
    const exported = buildBulkExport(collections, savedRequests);
    downloadJson(exported.filename, exported.data);
    showToast("Backup export started.", "success");
  };

  const openSaved = (savedRequestId: string) => {
    onOpenSavedRequest(savedRequestId);
    onAfterNavigate?.();
  };

  const openHistory = (historyEntryId: string) => {
    onOpenHistoryEntry(historyEntryId);
    onAfterNavigate?.();
  };

  return (
    <aside className="sidebar" aria-label="Collections and history">
      <div className="sidebar-header">
        <div>
          <h1>HTTP Workspace</h1>
          <p>Client-side request builder</p>
        </div>
      </div>

      <section className="sidebar-section">
        <div className="section-title-row">
          <h2>Collections</h2>
          <Button
            onClick={() =>
              openNameDialog({
                title: "Create collection",
                label: "Collection name",
                initialValue: "",
                onSubmit: onCreateCollection,
              })
            }
            size="sm"
            variant="secondary"
          >
            New
          </Button>
        </div>
        <div className="sidebar-actions-grid">
          <Button onClick={() => singleImportRef.current?.click()} size="sm" variant="secondary">
            Import collection
          </Button>
          <Button onClick={() => bulkImportRef.current?.click()} size="sm" variant="secondary">
            Import backup
          </Button>
          <Button onClick={exportBulk} size="sm" variant="secondary">
            Export all
          </Button>
        </div>
        <input
          accept="application/json"
          aria-label="Import collection JSON file"
          className="visually-hidden"
          id="single-collection-import-file"
          name="single-collection-import-file"
          onChange={(event) => {
            void handleFileImport(event.target.files?.[0], "single");
            event.target.value = "";
          }}
          ref={singleImportRef}
          type="file"
        />
        <input
          accept="application/json"
          aria-label="Import backup JSON file"
          className="visually-hidden"
          id="bulk-backup-import-file"
          name="bulk-backup-import-file"
          onChange={(event) => {
            void handleFileImport(event.target.files?.[0], "bulk");
            event.target.value = "";
          }}
          ref={bulkImportRef}
          type="file"
        />

        <div className="collection-list">
          {collections.map((collection) => {
            const collapsed = collapsedCollectionIds.includes(collection.id);
            const items = savedRequests.filter((saved) => saved.collectionId === collection.id);

            return (
              <div className="collection-block" key={collection.id}>
                <div className="collection-header">
                  <button
                    aria-label={`${collapsed ? "Expand" : "Collapse"} collection ${collection.name}`}
                    aria-expanded={!collapsed}
                    className="collection-toggle"
                    onClick={() => onToggleCollection(collection.id)}
                    type="button"
                  >
                    {collapsed ? "+" : "-"}
                  </button>
                  <div className="collection-title">
                    <strong>{collection.name}</strong>
                    <span>
                      {requestCount(collection.id, savedRequests)} saved
                      {collection.id === defaultCollectionId ? " - default" : ""}
                    </span>
                  </div>
                  <div className="mini-actions">
                    <Button
                      aria-label={`Rename ${collection.name}`}
                      onClick={() =>
                        openNameDialog({
                          title: "Rename collection",
                          label: "Collection name",
                          initialValue: collection.name,
                          onSubmit: (value) => onRenameCollection(collection.id, value),
                        })
                      }
                      size="sm"
                      variant="ghost"
                    >
                      Rename
                    </Button>
                    <Button
                      aria-label={`Export ${collection.name}`}
                      onClick={() => exportCollection(collection)}
                      size="sm"
                      variant="ghost"
                    >
                      Export
                    </Button>
                    <Button
                      aria-label={`Delete ${collection.name}`}
                      onClick={() =>
                        setConfirm({
                          title: "Delete collection",
                          message: `Delete "${collection.name}" and its ${items.length} saved request(s)? This cannot be undone.`,
                          confirmLabel: "Delete",
                          tone: "danger",
                          onConfirm: () => onDeleteCollection(collection.id),
                        })
                      }
                      size="sm"
                      variant="ghost"
                    >
                      Delete
                    </Button>
                  </div>
                </div>

                {!collapsed ? (
                  <div className="saved-list">
                    {items.length === 0 ? (
                      <EmptyState title="No saved requests" />
                    ) : (
                      items.map((saved) => (
                        <div className="saved-item" key={saved.id}>
                          <button className="saved-open" onClick={() => openSaved(saved.id)} type="button">
                            <strong>{saved.name}</strong>
                            <span>
                              {saved.request.method} {trimUrl(saved.request.baseUrl)}
                            </span>
                          </button>
                          <div className="saved-actions">
                            <Button
                              onClick={() =>
                                openNameDialog({
                                  title: "Rename saved request",
                                  label: "Request name",
                                  initialValue: saved.name,
                                  onSubmit: (value) => onRenameSavedRequest(saved.id, value),
                                })
                              }
                              size="sm"
                              variant="ghost"
                            >
                              Rename
                            </Button>
                            <Button
                              onClick={() => {
                                setMovingRequest(saved);
                                setMoveTarget(saved.collectionId);
                              }}
                              size="sm"
                              variant="ghost"
                            >
                              Move
                            </Button>
                            <Button
                              onClick={() =>
                                setConfirm({
                                  title: "Delete saved request",
                                  message: `Delete "${saved.name}"? Linked tabs will become independent.`,
                                  confirmLabel: "Delete",
                                  tone: "danger",
                                  onConfirm: () => onDeleteSavedRequest(saved.id),
                                })
                              }
                              size="sm"
                              variant="ghost"
                            >
                              Delete
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="sidebar-section">
        <div className="section-title-row">
          <button
            aria-label={`${isHistoryCollapsed ? "Expand" : "Collapse"} history`}
            aria-expanded={!isHistoryCollapsed}
            className="section-toggle-title"
            onClick={onToggleHistory}
            type="button"
          >
            {isHistoryCollapsed ? "+" : "-"} History
          </button>
          <Button
            disabled={history.length === 0}
            onClick={() =>
              setConfirm({
                title: "Clear history",
                message: "Clear all history entries? This does not delete saved requests.",
                confirmLabel: "Clear",
                tone: "danger",
                onConfirm: onClearHistory,
              })
            }
            size="sm"
            variant="ghost"
          >
            Clear
          </Button>
        </div>

        {!isHistoryCollapsed ? (
          <div className="history-list">
            {history.length === 0 ? (
              <EmptyState title="No history yet" description="Every send attempt will appear here." />
            ) : (
              history.map((entry) => (
                <div className="history-item" key={entry.id}>
                  <button className="history-open" onClick={() => openHistory(entry.id)} type="button">
                    <strong>
                      {entry.request.method} {entry.status ? `${entry.status} ${entry.statusText ?? ""}` : entry.errorKind ?? "Attempt"}
                    </strong>
                    <span>{entry.finalUrl || trimUrl(entry.request.baseUrl)}</span>
                    <small>{formatDisplayDate(entry.timestamp)}</small>
                  </button>
                  <Button
                    aria-label="Delete history entry"
                    onClick={() => onDeleteHistoryEntry(entry.id)}
                    size="sm"
                    variant="ghost"
                  >
                    X
                  </Button>
                </div>
              ))
            )}
          </div>
        ) : null}
      </section>

      <section className="sidebar-section theme-section">
        <label className="field" htmlFor="theme-preference">
          <span>Theme</span>
          <select
            id="theme-preference"
            name="theme-preference"
            onChange={(event) => onThemeChange(event.target.value as ThemePreference)}
            value={theme}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
      </section>

      <Modal
        footer={
          <>
            <Button onClick={() => setNameDialog(null)} variant="secondary">
              Cancel
            </Button>
            <Button onClick={submitNameDialog} variant="primary">
              Save
            </Button>
          </>
        }
        onClose={() => setNameDialog(null)}
        open={Boolean(nameDialog)}
        title={nameDialog?.title ?? ""}
      >
        <label className="field" htmlFor="name-dialog-value">
          <span>{nameDialog?.label}</span>
          <input
            data-autofocus="true"
            id="name-dialog-value"
            name="name-dialog-value"
            onChange={(event) => setNameValue(event.target.value)}
            value={nameValue}
          />
        </label>
      </Modal>

      <Modal
        footer={
          <>
            <Button onClick={() => setMovingRequest(null)} variant="secondary">
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (movingRequest && moveTarget) {
                  onMoveSavedRequest(movingRequest.id, moveTarget);
                }
                setMovingRequest(null);
              }}
              variant="primary"
            >
              Move
            </Button>
          </>
        }
        onClose={() => setMovingRequest(null)}
        open={Boolean(movingRequest)}
        title="Move saved request"
      >
        <label className="field" htmlFor="move-target-collection">
          <span>Target collection</span>
          <select
            id="move-target-collection"
            name="move-target-collection"
            onChange={(event) => setMoveTarget(event.target.value)}
            value={moveTarget}
          >
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
        </label>
      </Modal>

      <ConfirmDialog
        confirmLabel={confirm?.confirmLabel}
        message={confirm?.message ?? ""}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          confirm?.onConfirm();
          setConfirm(null);
        }}
        open={Boolean(confirm)}
        title={confirm?.title ?? ""}
        tone={confirm?.tone}
      />

      <ConfirmDialog
        confirmLabel="Import"
        message={pendingImport?.description ?? ""}
        onCancel={() => setPendingImport(null)}
        onConfirm={confirmImport}
        open={Boolean(pendingImport)}
        title="Confirm import"
      />
    </aside>
  );
}
