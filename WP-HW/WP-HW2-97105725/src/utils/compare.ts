import type { KeyValueRow, RequestConfig } from "../app/types";

function normalizeRows(rows: KeyValueRow[]): Array<Omit<KeyValueRow, "id">> {
  return rows
    .filter((row) => row.key.trim() !== "" || row.value.trim() !== "")
    .map((row) => ({
      key: row.key,
      value: row.value,
      enabled: row.enabled,
    }));
}

function comparableRequest(request: RequestConfig) {
  return {
    method: request.method,
    baseUrl: request.baseUrl,
    params: normalizeRows(request.params),
    headers: normalizeRows(request.headers),
    body: request.body,
  };
}

export function areRequestsEqual(left: RequestConfig, right: RequestConfig): boolean {
  return JSON.stringify(comparableRequest(left)) === JSON.stringify(comparableRequest(right));
}
