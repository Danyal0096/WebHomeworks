import { useMemo, useState } from "react";
import type { RequestConfig, RequestErrorState, ResponseSnapshot } from "../../app/types";
import { copyText } from "../../utils/clipboard";
import { generateCurl } from "../../utils/curl";
import { prettyJson } from "../../utils/json";
import { safeBuildFinalUrl, validateHttpUrl } from "../../utils/url";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";
import { useToast } from "../common/Toast";

type ResponseTab = "body" | "headers" | "raw";
type FontSize = "small" | "medium" | "large";

interface ResponseViewerProps {
  request: RequestConfig;
  sentRequest: RequestConfig | null;
  sentFinalUrl: string | null;
  response: ResponseSnapshot | null;
  error: RequestErrorState | null;
  isLoading: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function statusTone(status: number): string {
  if (status >= 500) {
    return "server-error";
  }

  if (status >= 400) {
    return "client-error";
  }

  if (status >= 200 && status < 300) {
    return "success";
  }

  return "neutral";
}

export function ResponseViewer({ request, sentRequest, sentFinalUrl, response, error, isLoading }: ResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<ResponseTab>("body");
  const [pretty, setPretty] = useState(true);
  const [wrap, setWrap] = useState(true);
  const [fontSize, setFontSize] = useState<FontSize>("medium");
  const { showToast } = useToast();

  const effectiveRequest = response?.request ?? sentRequest ?? request;
  const finalUrl =
    response?.finalUrl ?? sentFinalUrl ?? (validateHttpUrl(request.baseUrl) ? "" : safeBuildFinalUrl(request.baseUrl, request.params));
  const hasSentSnapshot = Boolean(response || sentRequest || sentFinalUrl);
  const bodyText = useMemo(() => {
    if (!response) {
      return "";
    }

    if (response.isJson && pretty) {
      return prettyJson(response.parsedJson);
    }

    return response.rawBody;
  }, [pretty, response]);

  const headerText = response
    ? Object.entries(response.headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join("\n")
    : "";

  const copy = async (label: string, text: string, allowEmpty = false) => {
    if (!allowEmpty && text === "") {
      showToast(`Nothing to copy for ${label}.`, "info");
      return;
    }

    try {
      await copyText(text);
      showToast(`${label} copied.`, "success");
    } catch (copyError) {
      showToast(copyError instanceof Error ? copyError.message : `Could not copy ${label}.`, "error");
    }
  };

  return (
    <section className="response-viewer" aria-label="Response viewer">
      <div className="response-header">
        <div>
          <h2>Response</h2>
          {response ? (
            <p className={`response-meta ${statusTone(response.status)}`}>
              <strong>
                {response.status} {response.statusText}
              </strong>
              <span>{response.durationMs} ms</span>
              <span>{formatBytes(response.sizeBytes)}</span>
            </p>
          ) : null}
          {hasSentSnapshot && finalUrl ? (
            <p className="sent-url">
              <span>{response ? "Sent URL" : isLoading ? "Sending URL" : "Attempted URL"}</span>
              <code>{finalUrl}</code>
            </p>
          ) : null}
        </div>
        <div className="response-actions">
          <Button onClick={() => copy("Final URL", finalUrl)} size="sm" variant="secondary">
            Copy URL
          </Button>
          <Button onClick={() => copy("Response body", response?.rawBody ?? "", true)} size="sm" variant="secondary">
            Copy body
          </Button>
          <Button onClick={() => copy("cURL command", generateCurl(effectiveRequest))} size="sm" variant="secondary">
            Copy cURL
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">Sending request...</div>
      ) : error ? (
        <div className="error-panel">
          <strong>{error.message}</strong>
          {error.details ? (
            <details>
              <summary>Technical details</summary>
              <pre>{error.details}</pre>
            </details>
          ) : null}
        </div>
      ) : response ? (
        <>
          <div className="response-tabs" role="tablist" aria-label="Response views">
            {(["body", "headers", "raw"] as ResponseTab[]).map((tab) => (
              <button
                aria-selected={activeTab === tab}
                className={activeTab === tab ? "active" : ""}
                key={tab}
                onClick={() => setActiveTab(tab)}
                role="tab"
                type="button"
              >
                {tab[0].toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {activeTab === "body" ? (
            <div className="response-body-panel">
              <div className="response-tools">
                {response.isJson ? (
                  <div className="segmented-control" role="group" aria-label="JSON body display">
                    <button aria-pressed={pretty} className={pretty ? "active" : ""} onClick={() => setPretty(true)} type="button">
                      Pretty
                    </button>
                    <button aria-pressed={!pretty} className={!pretty ? "active" : ""} onClick={() => setPretty(false)} type="button">
                      Raw
                    </button>
                  </div>
                ) : null}
                <label className="compact-toggle" htmlFor="response-wrap">
                  <input
                    checked={wrap}
                    id="response-wrap"
                    name="response-wrap"
                    onChange={(event) => setWrap(event.target.checked)}
                    type="checkbox"
                  />
                  Wrap
                </label>
                <label className="compact-select" htmlFor="response-font-size">
                  <span>Font</span>
                  <select
                    id="response-font-size"
                    name="response-font-size"
                    onChange={(event) => setFontSize(event.target.value as FontSize)}
                    value={fontSize}
                  >
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </label>
                <Button onClick={() => copy("Response body", bodyText, true)} size="sm" variant="secondary">
                  Copy
                </Button>
              </div>
              <pre className={`response-code font-${fontSize} ${wrap ? "wrap" : ""}`}>{bodyText || "(empty response body)"}</pre>
            </div>
          ) : null}

          {activeTab === "headers" ? (
            <div className="headers-panel">
              <div className="response-tools">
                <Button onClick={() => copy("Response headers", headerText)} size="sm" variant="secondary">
                  Copy headers
                </Button>
              </div>
              {Object.keys(response.headers).length > 0 ? (
                <dl className="headers-list">
                  {Object.entries(response.headers).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <EmptyState title="No response headers were exposed to the browser." />
              )}
            </div>
          ) : null}

          {activeTab === "raw" ? (
            <div className="response-body-panel">
              <div className="response-tools">
                <Button onClick={() => copy("Raw response", response.rawBody, true)} size="sm" variant="secondary">
                  Copy raw
                </Button>
              </div>
              <pre className={`response-code font-${fontSize} ${wrap ? "wrap" : ""}`}>{response.rawBody}</pre>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState title="No response yet" description="Send a request to see the response body, headers, timing, and size." />
      )}
    </section>
  );
}
