(function (app) {
  "use strict";

  function now() {
    return new Date().toISOString();
  }

  function sortNotes(notes, sortMode, locale) {
    var collator = new Intl.Collator(locale || "fa", { sensitivity: "base", numeric: true });
    return notes.slice().sort(function (a, b) {
      if (sortMode === "title-asc") {
        return collator.compare(a.title, b.title);
      }
      if (sortMode === "created-desc") {
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      }
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    });
  }

  function findNote(state, noteId) {
    return state.notes.find(function (note) {
      return note.id === noteId;
    });
  }

  function createNote(folderId) {
    var createdId = null;
    app.Store.mutate(function (state) {
      var timestamp = now();
      var targetFolderId = state.folders.some(function (folder) {
        return folder.id === folderId;
      }) ? folderId : null;
      createdId = app.IdService.createId("note");
      state.notes.push({
        id: createdId,
        title: app.I18nService.t("untitledNote"),
        content: "",
        folderId: targetFolderId,
        isPinned: false,
        createdAt: timestamp,
        updatedAt: timestamp
      });
      state.ui.selectedNoteId = createdId;
    });
    return createdId;
  }

  function updateNote(noteId, patch) {
    app.Store.mutate(function (state) {
      var note = findNote(state, noteId);
      var folderExists;
      if (!note) {
        return;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "title")) {
        note.title = String(patch.title);
      }
      if (Object.prototype.hasOwnProperty.call(patch, "content")) {
        note.content = String(patch.content);
      }
      if (Object.prototype.hasOwnProperty.call(patch, "folderId")) {
        folderExists = patch.folderId === null || state.folders.some(function (folder) { return folder.id === patch.folderId; });
        note.folderId = folderExists ? patch.folderId : null;
      }
      if (Object.prototype.hasOwnProperty.call(patch, "isPinned")) {
        note.isPinned = Boolean(patch.isPinned);
      }
      note.updatedAt = now();
    });
  }

  function deleteNote(noteId) {
    app.Store.mutate(function (state) {
      state.notes = state.notes.filter(function (note) {
        return note.id !== noteId;
      });
      if (state.ui.selectedNoteId === noteId) {
        state.ui.selectedNoteId = null;
      }
    });
  }

  function selectNote(noteId) {
    app.Store.mutate(function (state) {
      state.ui.selectedNoteId = state.notes.some(function (note) { return note.id === noteId; }) ? noteId : null;
    });
  }

  function setSortMode(sortMode) {
    if (app.Constants.SORT_MODES.indexOf(sortMode) === -1) {
      return;
    }
    app.Store.mutate(function (state) {
      state.settings.sortMode = sortMode;
    });
  }

  function setLocale(locale) {
    if (app.Constants.LOCALES.indexOf(locale) === -1) {
      return;
    }
    app.Store.mutate(function (state) {
      state.settings.locale = locale;
    });
  }

  function setTheme(theme) {
    if (app.Constants.THEMES.indexOf(theme) === -1) {
      return;
    }
    app.Store.mutate(function (state) {
      state.settings.theme = theme;
    });
  }

  app.NoteService = {
    sortNotes: sortNotes,
    createNote: createNote,
    updateNote: updateNote,
    deleteNote: deleteNote,
    selectNote: selectNote,
    setSortMode: setSortMode,
    setLocale: setLocale,
    setTheme: setTheme
  };
}(window.NotionLite));
