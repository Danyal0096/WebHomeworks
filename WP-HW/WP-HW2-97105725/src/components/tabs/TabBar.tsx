import { useState } from "react";
import type { RequestTab, SavedRequest } from "../../app/types";
import { UNTITLED_REQUEST_TITLE } from "../../app/defaults";
import { areRequestsEqual } from "../../utils/compare";
import { Button } from "../common/Button";
import { Modal } from "../common/Modal";

interface TabBarProps {
  tabs: RequestTab[];
  activeTabId: string;
  savedRequests: SavedRequest[];
  onSelect: (tabId: string) => void;
  onClose: (tabId: string) => void;
  onNew: () => void;
  onDuplicate: () => void;
  onRename: (tabId: string, title: string) => void;
}

function fallbackTitle(tab: RequestTab): string {
  if (tab.title.trim()) {
    return tab.title;
  }

  try {
    const url = new URL(tab.request.baseUrl);
    return `${tab.request.method} ${url.host}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return UNTITLED_REQUEST_TITLE;
  }
}

function isDirty(tab: RequestTab, savedRequests: SavedRequest[]): boolean {
  if (!tab.linkedSavedRequestId) {
    return false;
  }

  const saved = savedRequests.find((item) => item.id === tab.linkedSavedRequestId);
  return saved ? !areRequestsEqual(tab.request, saved.request) : false;
}

export function TabBar({
  tabs,
  activeTabId,
  savedRequests,
  onSelect,
  onClose,
  onNew,
  onDuplicate,
  onRename,
}: TabBarProps) {
  const [renameTab, setRenameTab] = useState<RequestTab | null>(null);
  const [title, setTitle] = useState("");

  const startRename = () => {
    const active = tabs.find((tab) => tab.id === activeTabId);
    if (!active) {
      return;
    }

    setRenameTab(active);
    setTitle(fallbackTitle(active));
  };

  const submitRename = () => {
    if (renameTab) {
      onRename(renameTab.id, title);
    }
    setRenameTab(null);
  };

  return (
    <div className="tabbar">
      <div className="tabs-scroll" role="tablist" aria-label="Request tabs">
        {tabs.map((tab) => (
          <div
            className={`tab-item ${tab.id === activeTabId ? "active" : ""}`}
            key={tab.id}
          >
            <button
              aria-selected={tab.id === activeTabId}
              className="tab-select"
              onClick={() => onSelect(tab.id)}
              role="tab"
              type="button"
            >
              {fallbackTitle(tab)}
              {isDirty(tab, savedRequests) ? <span className="dirty-marker" title="Unsaved changes">*</span> : null}
            </button>
            <button
              aria-label={`Close ${fallbackTitle(tab)}`}
              className="tab-close"
              onClick={() => onClose(tab.id)}
              type="button"
            >
              X
            </button>
          </div>
        ))}
      </div>
      <div className="tab-actions">
        <Button onClick={onNew} size="sm" variant="secondary">
          + New
        </Button>
        <Button onClick={startRename} size="sm" variant="secondary">
          Rename
        </Button>
        <Button onClick={onDuplicate} size="sm" variant="secondary">
          Duplicate
        </Button>
      </div>

      <Modal
        footer={
          <>
            <Button onClick={() => setRenameTab(null)} variant="secondary">
              Cancel
            </Button>
            <Button onClick={submitRename} variant="primary">
              Rename
            </Button>
          </>
        }
        onClose={() => setRenameTab(null)}
        open={Boolean(renameTab)}
        title="Rename tab"
      >
        <label className="field" htmlFor="rename-tab-title">
          <span>Tab title</span>
          <input
            data-autofocus="true"
            id="rename-tab-title"
            name="rename-tab-title"
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </label>
      </Modal>
    </div>
  );
}
