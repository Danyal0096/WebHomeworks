import type { BodyMode, RequestConfig, RequestErrorState } from "../../app/types";
import { useState } from "react";
import { HTTP_METHODS } from "../../app/defaults";
import { formatJson } from "../../utils/json";
import { parseUrlInput, safeBuildFinalUrl, validateHttpUrl } from "../../utils/url";
import { copyText } from "../../utils/clipboard";
import { Button } from "../common/Button";
import { KeyValueEditor } from "./KeyValueEditor";
import { useToast } from "../common/Toast";

interface RequestBuilderProps {
  request: RequestConfig;
  error: RequestErrorState | null;
  isLoading: boolean;
  isLinked: boolean;
  onChange: (request: RequestConfig) => void;
  onSend: () => void;
  onSave: () => void;
  onSaveAsNew: () => void;
  onClear: () => void;
}

function bodyModeLabel(mode: BodyMode): string {
  if (mode === "none") {
    return "None";
  }

  return mode === "raw" ? "Raw" : "JSON";
}

export function RequestBuilder({
  request,
  error,
  isLoading,
  isLinked,
  onChange,
  onSend,
  onSave,
  onSaveAsNew,
  onClear,
}: RequestBuilderProps) {
  const { showToast } = useToast();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const urlError = error?.kind === "validation" ? error.message : null;
  const finalUrl = validateHttpUrl(request.baseUrl) ? "" : safeBuildFinalUrl(request.baseUrl, request.params);

  const setRequest = (patch: Partial<RequestConfig>) => onChange({ ...request, ...patch });

  const updateUrl = (value: string) => {
    const parsed = parseUrlInput(value);
    if (parsed) {
      setRequest({ baseUrl: parsed.baseUrl, params: parsed.params });
      return;
    }

    setRequest({ baseUrl: value });
  };

  const updateBodyMode = (mode: BodyMode) => {
    setRequest({
      body: {
        mode,
        content: mode === "none" ? "" : request.body.content,
      },
    });
  };

  const copyFinalUrl = async () => {
    if (!finalUrl) {
      showToast("Enter a valid URL before copying the final URL.", "error");
      return;
    }

    try {
      await copyText(finalUrl);
      showToast("Final URL copied.", "success");
    } catch (copyError) {
      showToast(copyError instanceof Error ? copyError.message : "Could not copy the final URL.", "error");
    }
  };

  const formatJsonBody = () => {
    if (request.body.content.trim() === "") {
      showToast("There is no JSON body to format.", "info");
      return;
    }

    const formatted = formatJson(request.body.content);
    if (!formatted.ok) {
      showToast(`Invalid JSON: ${formatted.message}`, "error");
      return;
    }

    setRequest({ body: { mode: "json", content: formatted.value } });
    showToast("JSON formatted.", "success");
  };

  return (
    <div className="request-builder">
      <div className="request-line">
        <label className="field method-field" htmlFor="request-method">
          <span>Method</span>
          <select
            aria-label="HTTP method"
            id="request-method"
            name="request-method"
            onChange={(event) => setRequest({ method: event.target.value as RequestConfig["method"] })}
            value={request.method}
          >
            {HTTP_METHODS.map((method) => (
              <option key={method} value={method}>
                {method}
              </option>
            ))}
          </select>
        </label>
        <label className="field url-field" htmlFor="request-url">
          <span>URL</span>
          <input
            aria-invalid={Boolean(urlError)}
            id="request-url"
            name="request-url"
            onChange={(event) => updateUrl(event.target.value)}
            placeholder="https://api.example.com/users"
            value={request.baseUrl}
          />
        </label>
        <Button disabled={isLoading} onClick={onSend} variant="primary">
          {isLoading ? "Sending..." : "Send"}
        </Button>
      </div>

      {urlError ? <p className="inline-error">{urlError}</p> : null}

      <div className="final-url-row">
        <label className="field" htmlFor="request-final-url">
          <span>Final URL</span>
          <input
            id="request-final-url"
            name="request-final-url"
            readOnly
            value={finalUrl || "Enter a valid URL to preview the outgoing URL."}
          />
        </label>
        <Button onClick={copyFinalUrl} variant="secondary">
          Copy URL
        </Button>
      </div>

      <div className="request-actions">
        <Button onClick={onSave} variant="secondary">
          Save
        </Button>
        <div className="overflow-menu">
          <Button
            aria-expanded={isMoreOpen}
            aria-haspopup="menu"
            onClick={() => setIsMoreOpen((open) => !open)}
            variant="secondary"
          >
            More
          </Button>
          {isMoreOpen ? (
            <div className="overflow-menu-panel" role="menu">
              <button
                onClick={() => {
                  setIsMoreOpen(false);
                  onSaveAsNew();
                }}
                role="menuitem"
                type="button"
              >
                Save as new request
              </button>
            </div>
          ) : null}
        </div>
        <Button onClick={onClear} variant="ghost">
          Clear all fields
        </Button>
        {isLinked ? <span className="linked-note">Linked saved request</span> : null}
      </div>

      <KeyValueEditor
        keyPlaceholder="page"
        label="Params"
        onChange={(params) => setRequest({ params })}
        rows={request.params}
        valuePlaceholder="2"
      />

      <KeyValueEditor
        keyPlaceholder="Content-Type"
        label="Headers"
        onChange={(headers) => setRequest({ headers })}
        rows={request.headers}
        valuePlaceholder="application/json"
      />

      <section className="editor-section">
        <div className="section-title-row">
          <h3>Body</h3>
          <div className="segmented-control" role="group" aria-label="Body mode">
            {(["none", "raw", "json"] as BodyMode[]).map((mode) => (
              <button
                aria-pressed={request.body.mode === mode}
                className={request.body.mode === mode ? "active" : ""}
                key={mode}
                onClick={() => updateBodyMode(mode)}
                type="button"
              >
                {bodyModeLabel(mode)}
              </button>
            ))}
          </div>
        </div>

        {request.body.mode === "none" ? (
          <p className="muted body-empty">No request body will be sent.</p>
        ) : (
          <>
            {request.body.mode === "json" ? (
              <div className="body-tools">
                <Button onClick={formatJsonBody} size="sm" variant="secondary">
                  Format JSON
                </Button>
                <span className="muted">Content-Type is added automatically unless you enable your own.</span>
              </div>
            ) : null}
            <label className="field" htmlFor="request-body">
              <span>{request.body.mode === "json" ? "JSON body" : "Raw body"}</span>
              <textarea
                id="request-body"
                name="request-body"
                onChange={(event) =>
                  setRequest({
                    body: {
                      ...request.body,
                      content: event.target.value,
                    },
                  })
                }
                placeholder={request.body.mode === "json" ? "{\n  \"name\": \"Ada\"\n}" : "Plain text, XML, form data, or any raw body"}
                rows={8}
                spellCheck={false}
                value={request.body.content}
              />
            </label>
          </>
        )}

        {error?.kind === "json" || error?.kind === "unsupported-body" ? (
          <p className="inline-error">{error.message}</p>
        ) : null}
      </section>
    </div>
  );
}
