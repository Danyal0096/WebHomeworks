import type { KeyValueRow, RequestConfig } from "../app/types";
import { newId } from "./id";

export function createEmptyRow(): KeyValueRow {
  return {
    id: newId("row"),
    key: "",
    value: "",
    enabled: true,
  };
}

export function ensureEditableRows(rows: KeyValueRow[]): KeyValueRow[] {
  const normalized = rows.length > 0 ? rows : [createEmptyRow()];
  const hasEmpty = normalized.some((row) => row.key === "" && row.value === "");

  return hasEmpty ? normalized : [...normalized, createEmptyRow()];
}

export function cleanRowsForStorage(rows: KeyValueRow[]): KeyValueRow[] {
  const nonEmpty = rows.filter((row) => row.key.trim() !== "" || row.value.trim() !== "");
  return ensureEditableRows(nonEmpty.map((row) => ({ ...row })));
}

export function cloneRequestConfig(request: RequestConfig): RequestConfig {
  return {
    method: request.method,
    baseUrl: request.baseUrl,
    params: ensureEditableRows(request.params.map((row) => ({ ...row, id: newId("row") }))),
    headers: ensureEditableRows(request.headers.map((row) => ({ ...row, id: newId("row") }))),
    body: { ...request.body },
  };
}

export function normalizeRequestConfig(request: RequestConfig): RequestConfig {
  return {
    method: request.method,
    baseUrl: request.baseUrl,
    params: cleanRowsForStorage(request.params),
    headers: cleanRowsForStorage(request.headers),
    body: {
      mode: request.body.mode,
      content: request.body.content,
    },
  };
}
