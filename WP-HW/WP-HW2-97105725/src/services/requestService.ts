import type { RequestConfig, RequestErrorState, ResponseSnapshot } from "../app/types";
import { parseResponseJson, tryParseJson } from "../utils/json";
import { cloneRequestConfig } from "../utils/requestConfig";
import { buildFinalUrl, validateHttpUrl } from "../utils/url";

export interface PreparedRequest {
  finalUrl: string;
  init: RequestInit;
}

export type SendResult =
  | {
      kind: "response";
      finalUrl: string;
      response: ResponseSnapshot;
    }
  | {
      kind: "error";
      finalUrl: string;
      error: RequestErrorState;
      durationMs: number | null;
    };

export function buildEffectiveHeaders(request: RequestConfig): Record<string, string> {
  const headers: Record<string, string> = {};

  request.headers.forEach((row) => {
    if (row.enabled && row.key.trim() !== "") {
      headers[row.key.trim()] = row.value;
    }
  });

  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === "content-type");
  const hasJsonBody = request.body.mode === "json" && request.body.content.trim() !== "";

  if (hasJsonBody && !hasContentType) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

export function prepareRequest(request: RequestConfig): PreparedRequest | { error: RequestErrorState; finalUrl: string } {
  const urlError = validateHttpUrl(request.baseUrl);
  if (urlError) {
    return { error: urlError, finalUrl: "" };
  }

  const finalUrl = buildFinalUrl(request.baseUrl, request.params);
  const hasBody = request.body.mode !== "none" && request.body.content !== "";

  if (request.body.mode === "json") {
    if (request.body.content.trim() === "") {
      return {
        finalUrl,
        error: {
          kind: "json",
          message: "The JSON request body is empty. Enter valid JSON or choose None for no body.",
        },
      };
    }

    const parsed = tryParseJson(request.body.content);
    if (!parsed.ok) {
      return {
        finalUrl,
        error: {
          kind: "json",
          message: "The JSON request body is invalid. Fix it before sending.",
          details: parsed.message,
        },
      };
    }
  }

  if (request.method === "GET" && hasBody) {
    return {
      finalUrl,
      error: {
        kind: "unsupported-body",
        message: "GET requests cannot be sent with a body in the browser.",
      },
    };
  }

  const init: RequestInit = {
    method: request.method,
    headers: buildEffectiveHeaders(request),
  };

  if (hasBody) {
    init.body = request.body.content;
  }

  return { finalUrl, init };
}

export async function sendPreparedRequest(request: RequestConfig, prepared: PreparedRequest): Promise<SendResult> {
  const startedAt = performance.now();
  const requestSnapshot = cloneRequestConfig(request);

  try {
    const response = await fetch(prepared.finalUrl, prepared.init);
    const rawBody = await response.text();
    const durationMs = Math.round(performance.now() - startedAt);
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const contentType = response.headers.get("content-type");
    const parsed = parseResponseJson(rawBody, contentType);

    return {
      kind: "response",
      finalUrl: prepared.finalUrl,
      response: {
        status: response.status,
        statusText: response.statusText,
        headers,
        rawBody,
        parsedJson: parsed.parsedJson,
        isJson: parsed.isJson,
        contentType,
        durationMs,
        sizeBytes: new TextEncoder().encode(rawBody).length,
        finalUrl: prepared.finalUrl,
        request: requestSnapshot,
      },
    };
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    return {
      kind: "error",
      finalUrl: prepared.finalUrl,
      durationMs,
      error: {
        kind: "network",
        message:
          "The browser could not complete this request. The API may be unreachable, blocked by CORS, or the network may be unavailable.",
        details: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      },
    };
  }
}

export async function sendRequest(request: RequestConfig): Promise<SendResult> {
  const prepared = prepareRequest(request);
  if ("error" in prepared) {
    return {
      kind: "error",
      finalUrl: prepared.finalUrl,
      error: prepared.error,
      durationMs: null,
    };
  }

  return sendPreparedRequest(request, prepared);
}
