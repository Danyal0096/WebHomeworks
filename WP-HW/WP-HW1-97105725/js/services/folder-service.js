(function (app) {
  "use strict";

  function now() {
    return new Date().toISOString();
  }

  function createFolder(name) {
    var id = null;
    app.Store.mutate(function (state) {
      var timestamp = now();
      id = app.IdService.createId("folder");
      state.folders.push({
        id: id,
        name: String(name || app.I18nService.t("defaultFolderName")).trim() || app.I18nService.t("defaultFolderName"),
        createdAt: timestamp,
        updatedAt: timestamp
      });
    });
    return id;
  }

  function renameFolder(folderId, name) {
    app.Store.mutate(function (state) {
      var folder = state.folders.find(function (item) { return item.id === folderId; });
      if (!folder) {
        return;
      }
      folder.name = String(name || folder.name).trim() || folder.name;
      folder.updatedAt = now();
    });
  }

  function deleteFolder(folderId) {
    app.Store.mutate(function (state) {
      state.folders = state.folders.filter(function (folder) {
        return folder.id !== folderId;
      });
      state.notes = state.notes.filter(function (note) {
        return note.folderId !== folderId;
      });
      state.ui.collapsedFolderIds = state.ui.collapsedFolderIds.filter(function (id) {
        return id !== folderId;
      });
      if (state.ui.selectedNoteId && !state.notes.some(function (note) { return note.id === state.ui.selectedNoteId; })) {
        state.ui.selectedNoteId = null;
      }
    });
  }

  function toggleCollapsed(folderId) {
    app.Store.mutate(function (state) {
      var index = state.ui.collapsedFolderIds.indexOf(folderId);
      if (index >= 0) {
        state.ui.collapsedFolderIds.splice(index, 1);
      } else if (state.folders.some(function (folder) { return folder.id === folderId; })) {
        state.ui.collapsedFolderIds.push(folderId);
      }
    });
  }

  app.FolderService = {
    createFolder: createFolder,
    renameFolder: renameFolder,
    deleteFolder: deleteFolder,
    toggleCollapsed: toggleCollapsed
  };
}(window.NotionLite));
