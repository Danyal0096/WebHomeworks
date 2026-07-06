import type { KeyValueRow, RequestConfig } from "../app/types";
import { buildEffectiveHeaders } from "../services/requestService";
import { safeBuildFinalUrl } from "./url";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function enabledHeaderRows(rows: KeyValueRow[]): KeyValueRow[] {
  return rows.filter((row) => row.enabled && row.key.trim() !== "");
}

export function generateCurl(request: RequestConfig): string {
  const parts = ["curl", "-X", request.method, shellQuote(safeBuildFinalUrl(request.baseUrl, request.params))];
  const effectiveHeaders = buildEffectiveHeaders(request);
  const headerRows = enabledHeaderRows(request.headers);
  const explicitHeaderKeys = new Set(headerRows.map((row) => row.key.trim().toLowerCase()));

  headerRows.forEach((row) => {
    parts.push("-H", shellQuote(`${row.key.trim()}: ${row.value}`));
  });

  Object.entries(effectiveHeaders).forEach(([key, value]) => {
    if (!explicitHeaderKeys.has(key.toLowerCase())) {
      parts.push("-H", shellQuote(`${key}: ${value}`));
    }
  });

  if (request.body.mode !== "none" && request.body.content !== "") {
    parts.push("--data-raw", shellQuote(request.body.content));
  }

  return parts.join(" ");
}
