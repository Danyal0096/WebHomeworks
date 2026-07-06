(function (app) {
  "use strict";

  var searchText = "";
  var bound = false;

  function makeNoteButton(note, selectedId) {
    var li = app.Dom.el("li", { className: "note-item" });
    var button = app.Dom.el("button", {
      className: "note-button" + (note.id === selectedId ? " is-selected" : ""),
      attrs: { type: "button", "data-note-id": note.id }
    });
    var line = app.Dom.el("span", { className: "note-title-line" });
    if (note.isPinned) {
      line.appendChild(app.Dom.el("span", { className: "pin-marker", text: "●", attrs: { "aria-hidden": "true" } }));
    }
    line.appendChild(app.Dom.el("span", { className: "note-title", text: note.title || app.I18nService.t("untitledNote") }));
    button.appendChild(line);
    li.appendChild(button);
    return li;
  }

  function renderNoteList(notes, selectedId, emptyKey) {
    var list = app.Dom.el("ul", { className: "note-list" });
    if (!notes.length) {
      list.appendChild(app.Dom.el("li", { className: "empty-list", text: app.I18nService.t(emptyKey) }));
      return list;
    }
    notes.forEach(function (note) {
      list.appendChild(makeNoteButton(note, selectedId));
    });
    return list;
  }

  function section(titleKey) {
    var wrapper = app.Dom.el("section", { className: "section" });
    wrapper.appendChild(app.Dom.el("div", { className: "section-header", text: app.I18nService.t(titleKey) }));
    return wrapper;
  }

  function renderSearch(root, state) {
    var search = searchText.trim().toLocaleLowerCase();
    var notes = state.notes.filter(function (note) {
      return note.title.toLocaleLowerCase().indexOf(search) !== -1 || note.content.toLocaleLowerCase().indexOf(search) !== -1;
    });
    notes = app.NoteService.sortNotes(notes, state.settings.sortMode, state.settings.locale);
    var wrapper = section("searchResults");
    wrapper.appendChild(renderNoteList(notes, state.ui.selectedNoteId, "noResults"));
    root.appendChild(wrapper);
  }

  function renderFolders(root, state) {
    var wrapper = section("folders");
    var collator = new Intl.Collator(state.settings.locale, { sensitivity: "base", numeric: true });
    var folders = state.folders.slice().sort(function (a, b) {
      return collator.compare(a.name, b.name);
    });

    if (!folders.length) {
      wrapper.appendChild(app.Dom.el("div", { className: "empty-list", text: app.I18nService.t("noFolders") }));
      root.appendChild(wrapper);
      return;
    }

    folders.forEach(function (folder) {
      var collapsed = state.ui.collapsedFolderIds.indexOf(folder.id) !== -1;
      var block = app.Dom.el("div", { className: "folder-block" });
      var row = app.Dom.el("div", { className: "folder-row" });
      var toggle = app.Dom.el("button", {
        className: "folder-toggle",
        text: (collapsed ? "▸ " : "▾ ") + folder.name,
        attrs: { type: "button", "data-folder-toggle": folder.id, "aria-expanded": String(!collapsed) }
      });
      var rename = app.Dom.el("button", { className: "icon-button", text: "✎", attrs: { type: "button", title: app.I18nService.t("rename"), "aria-label": app.I18nService.t("rename"), "data-folder-rename": folder.id } });
      var remove = app.Dom.el("button", { className: "icon-button", text: "×", attrs: { type: "button", title: app.I18nService.t("delete"), "aria-label": app.I18nService.t("delete"), "data-folder-delete": folder.id } });
      row.appendChild(toggle);
      row.appendChild(rename);
      row.appendChild(remove);
      block.appendChild(row);
      if (!collapsed) {
        var notes = app.NoteService.sortNotes(state.notes.filter(function (note) {
          return note.folderId === folder.id;
        }), state.settings.sortMode, state.settings.locale);
        var notesWrap = app.Dom.el("div", { className: "folder-notes" });
        notesWrap.appendChild(renderNoteList(notes, state.ui.selectedNoteId, "noFolderNotes"));
        block.appendChild(notesWrap);
      }
      wrapper.appendChild(block);
    });
    root.appendChild(wrapper);
  }

  function render(state) {
    var root = app.Dom.qs("#sidebarContent");
    var pinned;
    var unfiled;
    app.Dom.clear(root);
    app.Dom.qs("#sortSelect").value = state.settings.sortMode;
    app.Dom.qs("#searchInput").value = searchText;

    if (searchText.trim()) {
      renderSearch(root, state);
      return;
    }

    pinned = app.NoteService.sortNotes(state.notes.filter(function (note) {
      return note.isPinned;
    }), state.settings.sortMode, state.settings.locale);
    var pinnedSection = section("pinnedNotes");
    pinnedSection.appendChild(renderNoteList(pinned, state.ui.selectedNoteId, "noPinned"));
    root.appendChild(pinnedSection);

    renderFolders(root, state);

    unfiled = app.NoteService.sortNotes(state.notes.filter(function (note) {
      return note.folderId === null;
    }), state.settings.sortMode, state.settings.locale);
    var unfiledSection = section("unfiledNotes");
    unfiledSection.appendChild(renderNoteList(unfiled, state.ui.selectedNoteId, "noUnfiled"));
    root.appendChild(unfiledSection);
  }

  function bind() {
    if (bound) {
      return;
    }
    bound = true;

    app.Dom.qs("#searchInput").addEventListener("input", function (event) {
      searchText = event.target.value;
      render(app.Store.getState());
    });

    app.Dom.qs("#sortSelect").addEventListener("change", function (event) {
      app.NoteService.setSortMode(event.target.value);
    });

    app.Dom.qs(".sidebar").addEventListener("click", function (event) {
      var target = event.target;
      var noteButton = target.closest("[data-note-id]");
      var folderToggle = target.closest("[data-folder-toggle]");
      var folderRename = target.closest("[data-folder-rename]");
      var folderDelete = target.closest("[data-folder-delete]");
      var action = target.closest("[data-action]");

      if (noteButton) {
        app.NoteService.selectNote(noteButton.getAttribute("data-note-id"));
        app.EditorController.reset();
        return;
      }
      if (folderToggle) {
        app.FolderService.toggleCollapsed(folderToggle.getAttribute("data-folder-toggle"));
        return;
      }
      if (folderRename) {
        renameFolder(folderRename.getAttribute("data-folder-rename"));
        return;
      }
      if (folderDelete) {
        deleteFolder(folderDelete.getAttribute("data-folder-delete"));
        return;
      }
      if (action) {
        handleAction(action.getAttribute("data-action"));
      }
    });

    app.Dom.qs("#importInput").addEventListener("change", function (event) {
      var file = event.target.files[0];
      if (file) {
        handleImport(file);
      }
      event.target.value = "";
    });
  }

  function createNote() {
    app.NoteService.createNote(null);
    app.EditorController.enterEditMode();
    app.Toast.show(app.I18nService.t("noteCreated"));
  }

  function createFolder() {
    app.Modal.prompt({
      title: app.I18nService.t("promptFolderTitle"),
      text: app.I18nService.t("promptFolderText"),
      placeholder: app.I18nService.t("folderNamePlaceholder"),
      confirmText: app.I18nService.t("create")
    }).then(function (value) {
      if (value) {
        app.FolderService.createFolder(value);
        app.Toast.show(app.I18nService.t("folderCreated"));
      }
    });
  }

  function renameFolder(folderId) {
    var state = app.Store.getState();
    var folder = state.folders.find(function (item) { return item.id === folderId; });
    if (!folder) {
      return;
    }
    app.Modal.prompt({
      title: app.I18nService.t("promptRenameFolderTitle"),
      value: folder.name,
      placeholder: app.I18nService.t("folderNamePlaceholder"),
      confirmText: app.I18nService.t("save")
    }).then(function (value) {
      if (value) {
        app.FolderService.renameFolder(folderId, value);
        app.Toast.show(app.I18nService.t("folderRenamed"));
      }
    });
  }

  function deleteFolder(folderId) {
    app.Modal.confirm({
      title: app.I18nService.t("confirmDeleteFolderTitle"),
      text: app.I18nService.t("confirmDeleteFolderText"),
      confirmText: app.I18nService.t("delete"),
      danger: true
    }).then(function (ok) {
      if (ok) {
        app.FolderService.deleteFolder(folderId);
        app.EditorController.reset();
        app.Toast.show(app.I18nService.t("folderDeleted"));
      }
    });
  }

  function handleImport(file) {
    app.TransferService.readJsonFile(file).then(function (json) {
      var validation = app.ValidationService.validateState(json);
      if (!validation.ok) {
        app.Toast.show(app.I18nService.t(validation.reason || "importInvalid"), "error");
        return;
      }
      app.Modal.confirm({
        title: app.I18nService.t("confirmImportTitle"),
        text: app.I18nService.t("confirmImportText"),
        confirmText: app.I18nService.t("confirm"),
        danger: true
      }).then(function (ok) {
        if (ok) {
          searchText = "";
          app.EditorController.reset();
          app.Store.replace(json);
          app.Toast.show(app.I18nService.t("importSuccess"));
        }
      });
    }).catch(function () {
      app.Toast.show(app.I18nService.t("importInvalid"), "error");
    });
  }

  function handleAction(action) {
    var state = app.Store.getState();
    if (action === "create-note") {
      createNote();
    } else if (action === "create-folder") {
      createFolder();
    } else if (action === "export") {
      app.TransferService.exportState();
      app.Toast.show(app.I18nService.t("exportSuccess"));
    } else if (action === "import") {
      app.Dom.qs("#importInput").click();
    } else if (action === "toggle-theme") {
      app.NoteService.setTheme(state.settings.theme === "dark" ? "light" : "dark");
    } else if (action === "toggle-locale") {
      app.NoteService.setLocale(state.settings.locale === "fa" ? "en" : "fa");
    }
  }

  function resetSearch() {
    searchText = "";
  }

  app.SidebarView = {
    bind: bind,
    render: render,
    resetSearch: resetSearch
  };
}(window.NotionLite));
