import type { KeyValueRow, RequestErrorState } from "../app/types";
import { createEmptyRow, ensureEditableRows } from "./requestConfig";

export interface UrlParseResult {
  baseUrl: string;
  params: KeyValueRow[];
}

export function validateHttpUrl(baseUrl: string): RequestErrorState | null {
  if (baseUrl.trim() === "") {
    return {
      kind: "validation",
      message: "Enter an absolute http:// or https:// URL before sending.",
    };
  }

  try {
    const url = new URL(baseUrl);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return {
        kind: "validation",
        message: "Only absolute http:// and https:// URLs can be sent from the browser.",
      };
    }
  } catch {
    return {
      kind: "validation",
      message: "This URL is not valid. Use a full URL such as https://api.example.com/users.",
    };
  }

  return null;
}

export function parseUrlInput(value: string): UrlParseResult | null {
  if (!value.includes("?")) {
    return null;
  }

  try {
    const url = new URL(value);
    const params = Array.from(url.searchParams.entries()).map(([key, paramValue]) => ({
      ...createEmptyRow(),
      key,
      value: paramValue,
    }));

    url.search = "";
    url.hash = "";

    return {
      baseUrl: url.toString(),
      params: ensureEditableRows(params),
    };
  } catch {
    return null;
  }
}

export function buildFinalUrl(baseUrl: string, params: KeyValueRow[]): string {
  const url = new URL(baseUrl);
  url.search = "";

  const query = new URLSearchParams();
  params.forEach((row) => {
    if (!row.enabled) {
      return;
    }

    if (row.key === "" && row.value === "") {
      return;
    }

    query.append(row.key, row.value);
  });

  const queryString = query.toString();
  if (queryString) {
    url.search = queryString;
  }

  return url.toString();
}

export function safeBuildFinalUrl(baseUrl: string, params: KeyValueRow[]): string {
  if (validateHttpUrl(baseUrl)) {
    return baseUrl;
  }

  return buildFinalUrl(baseUrl, params);
}

export function makeSafeFilenamePart(name: string): string {
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return safe || "collection";
}
