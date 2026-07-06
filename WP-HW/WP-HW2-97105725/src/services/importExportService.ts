import type { Collection, ImportCollectionPayload, SavedRequest, ValidImportPayload } from "../app/types";
import { formatFileTimestamp, formatImportTimestamp, nowIso } from "../utils/dates";
import { newId } from "../utils/id";
import { normalizeRequestConfig } from "../utils/requestConfig";
import { makeSafeFilenamePart } from "../utils/url";
import { isRequestConfig } from "./storageService";

type ExpectedImport = "single" | "bulk";

interface ExportCollection {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface ExportSavedRequest {
  id: string;
  name: string;
  collectionId: string;
  request: SavedRequest["request"];
  createdAt: string;
  updatedAt: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function buildCollectionExport(collection: Collection, savedRequests: SavedRequest[]): {
  filename: string;
  data: unknown;
} {
  return {
    filename: `collection-${makeSafeFilenamePart(collection.name)}-${formatFileTimestamp()}.json`,
    data: {
      schemaVersion: 1,
      type: "single-collection",
      exportedAt: nowIso(),
      collection,
      savedRequests: savedRequests.filter((saved) => saved.collectionId === collection.id),
    },
  };
}

export function buildBulkExport(collections: Collection[], savedRequests: SavedRequest[]): {
  filename: string;
  data: unknown;
} {
  return {
    filename: `collections-backup-${formatFileTimestamp()}.json`,
    data: {
      schemaVersion: 1,
      type: "collections-backup",
      exportedAt: nowIso(),
      collections,
      savedRequests,
    },
  };
}

export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text);
}

function validateSavedRequests(values: unknown, context: string): ExportSavedRequest[] {
  if (!Array.isArray(values)) {
    throw new Error(`${context} is missing a valid savedRequests array.`);
  }

  return values.map((saved, index) => {
    const itemLabel = `${context} saved request #${index + 1}`;
    if (!isObject(saved)) {
      throw new Error(`${itemLabel} is not an object.`);
    }

    if (typeof saved.name !== "string" || saved.name.trim() === "") {
      throw new Error(`${itemLabel} is missing a valid name.`);
    }

    if (!isRequestConfig(saved.request)) {
      throw new Error(`${itemLabel} has an invalid request configuration.`);
    }

    return {
      id: typeof saved.id === "string" ? saved.id : "",
      name: saved.name,
      collectionId: typeof saved.collectionId === "string" ? saved.collectionId : "",
      request: normalizeRequestConfig(saved.request),
      createdAt: typeof saved.createdAt === "string" ? saved.createdAt : nowIso(),
      updatedAt: typeof saved.updatedAt === "string" ? saved.updatedAt : nowIso(),
    };
  });
}

export function validateImport(data: unknown, expected: ExpectedImport): ValidImportPayload {
  if (!isObject(data) || data.schemaVersion !== 1) {
    throw new Error("The selected file is not a supported Homework 2 export.");
  }

  if (expected === "single") {
    if (data.type !== "single-collection" || !isObject(data.collection)) {
      throw new Error("Choose a single collection export file.");
    }

    const collectionName = data.collection.name;
    if (typeof collectionName !== "string" || collectionName.trim() === "") {
      throw new Error("The collection export is missing a collection name.");
    }

    return {
      mode: "single",
      collections: [
        {
          name: collectionName,
          savedRequests: validateSavedRequests(data.savedRequests, `Collection "${collectionName}"`).map((saved) => ({
            name: saved.name,
            request: saved.request,
            createdAt: saved.createdAt,
            updatedAt: saved.updatedAt,
          })),
        },
      ],
    };
  }

  if (data.type !== "collections-backup" || !Array.isArray(data.collections)) {
    throw new Error("Choose a bulk collections backup file.");
  }

  const exportedCollections = data.collections.map((collection, index) => {
    const collectionLabel = `Bulk collection #${index + 1}`;
    if (!isObject(collection)) {
      throw new Error(`${collectionLabel} is not an object.`);
    }

    if (typeof collection.id !== "string" || collection.id.trim() === "") {
      throw new Error(`${collectionLabel} is missing a valid id.`);
    }

    if (typeof collection.name !== "string" || collection.name.trim() === "") {
      throw new Error(`${collectionLabel} is missing a valid name.`);
    }

    return {
      id: collection.id,
      name: collection.name,
      createdAt: typeof collection.createdAt === "string" ? collection.createdAt : nowIso(),
      updatedAt: typeof collection.updatedAt === "string" ? collection.updatedAt : nowIso(),
    };
  });

  const exportedRequests = validateSavedRequests(data.savedRequests, "Bulk import");

  return {
    mode: "bulk",
    collections: exportedCollections.map((collection) => ({
      name: collection.name,
      savedRequests: exportedRequests
        .filter((saved) => saved.collectionId === collection.id)
        .map((saved) => ({
          name: saved.name,
          request: saved.request,
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
        })),
    })),
  };
}

function makeUniqueCollectionName(baseName: string, existingNames: Set<string>, importStamp: string): string {
  if (!existingNames.has(baseName)) {
    existingNames.add(baseName);
    return baseName;
  }

  const importedBase = `${baseName} (Imported ${importStamp})`;
  let candidate = importedBase;
  let suffix = 2;

  while (existingNames.has(candidate)) {
    candidate = `${baseName} (Imported ${importStamp} - ${suffix})`;
    suffix += 1;
  }

  existingNames.add(candidate);
  return candidate;
}

export function materializeImport(
  payload: ValidImportPayload,
  existingCollections: Collection[],
): { collections: Collection[]; savedRequests: SavedRequest[] } {
  const existingNames = new Set(existingCollections.map((collection) => collection.name));
  const importStamp = formatImportTimestamp();
  const timestamp = nowIso();
  const collections: Collection[] = [];
  const savedRequests: SavedRequest[] = [];

  payload.collections.forEach((incoming) => {
    const collection: Collection = {
      id: newId("collection"),
      name: makeUniqueCollectionName(incoming.name, existingNames, importStamp),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    collections.push(collection);

    incoming.savedRequests.forEach((saved) => {
      savedRequests.push({
        id: newId("saved"),
        name: saved.name,
        collectionId: collection.id,
        request: normalizeRequestConfig(saved.request),
        createdAt: saved.createdAt ?? timestamp,
        updatedAt: saved.updatedAt ?? timestamp,
      });
    });
  });

  return { collections, savedRequests };
}

export function describeImport(payload: ValidImportPayload): string {
  const requestCount = payload.collections.reduce((total, collection) => total + collection.savedRequests.length, 0);
  const collectionWord = payload.collections.length === 1 ? "collection" : "collections";
  const requestWord = requestCount === 1 ? "saved request" : "saved requests";
  return `This will add ${payload.collections.length} ${collectionWord} and ${requestCount} ${requestWord}. Existing data will not be replaced.`;
}
