export function tryParseJson(text: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Invalid JSON.",
    };
  }
}

export function formatJson(text: string): { ok: true; value: string } | { ok: false; message: string } {
  const parsed = tryParseJson(text);
  if (!parsed.ok) {
    return parsed;
  }

  return { ok: true, value: JSON.stringify(parsed.value, null, 2) };
}

export function parseResponseJson(rawBody: string, contentType: string | null): { isJson: boolean; parsedJson: unknown | null } {
  if (!rawBody.trim()) {
    return { isJson: false, parsedJson: null };
  }

  void contentType;
  const parsed = tryParseJson(rawBody);

  if (parsed.ok) {
    return { isJson: true, parsedJson: parsed.value };
  }

  return { isJson: false, parsedJson: null };
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
