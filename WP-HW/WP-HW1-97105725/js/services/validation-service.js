(function (app) {
  "use strict";

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function isIsoDate(value) {
    var isoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
    return typeof value === "string" && isoTimestampPattern.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString() === value;
  }

  function normalizeSettings(settings) {
    var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return {
      locale: settings && app.Constants.LOCALES.indexOf(settings.locale) !== -1 ? settings.locale : "fa",
      theme: settings && app.Constants.THEMES.indexOf(settings.theme) !== -1 ? settings.theme : (prefersDark ? "dark" : "light"),
      sortMode: settings && app.Constants.SORT_MODES.indexOf(settings.sortMode) !== -1 ? settings.sortMode : "updated-desc"
    };
  }

  function emptyState() {
    return {
      schemaVersion: app.Constants.SCHEMA_VERSION,
      settings: normalizeSettings(null),
      folders: [],
      notes: [],
      ui: {
        selectedNoteId: null,
        collapsedFolderIds: []
      }
    };
  }

  function validateState(value) {
    var ids = Object.create(null);
    var folderIds = Object.create(null);
    var noteIds = Object.create(null);

    if (!isObject(value) || value.schemaVersion !== 1 || !isObject(value.settings) || !Array.isArray(value.folders) || !Array.isArray(value.notes) || !isObject(value.ui)) {
      return { ok: false, reason: "invalidImportShape" };
    }
    if (app.Constants.LOCALES.indexOf(value.settings.locale) === -1 || app.Constants.THEMES.indexOf(value.settings.theme) === -1 || app.Constants.SORT_MODES.indexOf(value.settings.sortMode) === -1) {
      return { ok: false, reason: "invalidImportShape" };
    }

    for (var i = 0; i < value.folders.length; i += 1) {
      var folder = value.folders[i];
      if (!isObject(folder) || typeof folder.id !== "string" || typeof folder.name !== "string" || !isIsoDate(folder.createdAt) || !isIsoDate(folder.updatedAt)) {
        return { ok: false, reason: "invalidImportShape" };
      }
      if (ids[folder.id]) {
        return { ok: false, reason: "invalidImportDuplicateIds" };
      }
      ids[folder.id] = true;
      folderIds[folder.id] = true;
    }

    for (var j = 0; j < value.notes.length; j += 1) {
      var note = value.notes[j];
      if (!isObject(note) || typeof note.id !== "string" || typeof note.title !== "string" || typeof note.content !== "string" || !(note.folderId === null || typeof note.folderId === "string") || typeof note.isPinned !== "boolean" || !isIsoDate(note.createdAt) || !isIsoDate(note.updatedAt)) {
        return { ok: false, reason: "invalidImportShape" };
      }
      if (ids[note.id]) {
        return { ok: false, reason: "invalidImportDuplicateIds" };
      }
      if (note.folderId !== null && !folderIds[note.folderId]) {
        return { ok: false, reason: "invalidImportShape" };
      }
      ids[note.id] = true;
      noteIds[note.id] = true;
    }

    if (!(value.ui.selectedNoteId === null || typeof value.ui.selectedNoteId === "string") || !Array.isArray(value.ui.collapsedFolderIds)) {
      return { ok: false, reason: "invalidImportShape" };
    }
    if (value.ui.selectedNoteId !== null && !noteIds[value.ui.selectedNoteId]) {
      return { ok: false, reason: "invalidImportShape" };
    }
    for (var k = 0; k < value.ui.collapsedFolderIds.length; k += 1) {
      if (typeof value.ui.collapsedFolderIds[k] !== "string" || !folderIds[value.ui.collapsedFolderIds[k]]) {
        return { ok: false, reason: "invalidImportShape" };
      }
    }

    return { ok: true };
  }

  function cloneState(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeForRuntime(value) {
    var validation = validateState(value);
    if (!validation.ok) {
      return emptyState();
    }
    return cloneState(value);
  }

  app.ValidationService = {
    emptyState: emptyState,
    normalizeSettings: normalizeSettings,
    normalizeForRuntime: normalizeForRuntime,
    validateState: validateState,
    cloneState: cloneState
  };
}(window.NotionLite));
