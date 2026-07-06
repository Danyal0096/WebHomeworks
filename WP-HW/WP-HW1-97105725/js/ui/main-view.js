(function (app) {
  "use strict";

  var renderedNoteId = null;
  var renderedMode = null;
  var renderedLocale = null;
  var renderedFolderSignature = null;

  function getSelectedNote(state) {
    return state.notes.find(function (note) {
      return note.id === state.ui.selectedNoteId;
    }) || null;
  }

  function formatDate(value, locale) {
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
    } catch (error) {
      return value;
    }
  }

  function renderEmpty(root) {
    var section = app.Dom.el("section", { className: "document empty-state" });
    section.appendChild(app.Dom.el("h2", { text: app.I18nService.t("emptyTitle") }));
    section.appendChild(app.Dom.el("p", { text: app.I18nService.t("emptyText") }));
    section.appendChild(app.Dom.el("button", { className: "primary-button", text: app.I18nService.t("newNote"), attrs: { type: "button", "data-main-action": "create-note" } }));
    root.appendChild(section);
  }

  function renderView(root, note, state) {
    var article = app.Dom.el("article", { className: "document note-view" });
    var actions = app.Dom.el("div", { className: "note-actions" });
    article.appendChild(app.Dom.el("h2", { text: note.title || app.I18nService.t("untitledNote") }));
    article.appendChild(app.Dom.el("div", {
      className: "note-meta",
      text: app.I18nService.t("created") + ": " + formatDate(note.createdAt, state.settings.locale) + " · " + app.I18nService.t("updated") + ": " + formatDate(note.updatedAt, state.settings.locale)
    }));
    actions.appendChild(app.Dom.el("button", { className: "primary-button", text: app.I18nService.t("edit"), attrs: { type: "button", "data-main-action": "edit" } }));
    actions.appendChild(app.Dom.el("button", { className: "secondary-button", text: app.I18nService.t(note.isPinned ? "unpin" : "pin"), attrs: { type: "button", "data-main-action": "toggle-pin" } }));
    actions.appendChild(app.Dom.el("button", { className: "danger-button", text: app.I18nService.t("delete"), attrs: { type: "button", "data-main-action": "delete-note" } }));
    article.appendChild(actions);
    article.appendChild(app.Dom.el("div", { className: "markdown-body", html: app.MarkdownService.render(note.content) }));
    root.appendChild(article);
  }

  function renderEditor(root, note, state) {
    var form = app.Dom.el("section", { className: "document note-editor" });
    var title = app.Dom.el("input", { className: "editor-title", attrs: { id: "noteTitleInput", type: "text", placeholder: app.I18nService.t("titlePlaceholder") } });
    var folderLabel = app.Dom.el("label", { className: "field-label", text: app.I18nService.t("folderLabel"), attrs: { for: "folderSelect" } });
    var folderSelect = app.Dom.el("select", { attrs: { id: "folderSelect" } });
    var toolbar = app.Dom.el("div", { className: "editor-toolbar", attrs: { "aria-label": app.I18nService.t("editorToolbarLabel") } });
    var colorInput = app.Dom.el("input", { attrs: { id: "textColorInput", type: "color", value: "#2f6f5e", "aria-label": app.I18nService.t("toolbarColor"), title: app.I18nService.t("toolbarColor") } });
    var textarea = app.Dom.el("textarea", { attrs: { id: "noteContentInput", placeholder: app.I18nService.t("contentPlaceholder") } });
    var actions = app.Dom.el("div", { className: "editor-actions" });

    title.value = note.title;
    folderSelect.appendChild(app.Dom.el("option", { text: app.I18nService.t("noFolder"), attrs: { value: "" } }));
    state.folders.forEach(function (folder) {
      folderSelect.appendChild(app.Dom.el("option", { text: folder.name, attrs: { value: folder.id } }));
    });
    folderSelect.value = note.folderId || "";

    toolbar.appendChild(app.Dom.el("button", { className: "secondary-button", text: "B", attrs: { type: "button", title: app.I18nService.t("toolbarBold"), "aria-label": app.I18nService.t("toolbarBold"), "data-format": "bold" } }));
    toolbar.appendChild(app.Dom.el("button", { className: "secondary-button", text: "I", attrs: { type: "button", title: app.I18nService.t("toolbarItalic"), "aria-label": app.I18nService.t("toolbarItalic"), "data-format": "italic" } }));
    toolbar.appendChild(app.Dom.el("button", { className: "secondary-button", text: "U", attrs: { type: "button", title: app.I18nService.t("toolbarUnderline"), "aria-label": app.I18nService.t("toolbarUnderline"), "data-format": "underline" } }));
    toolbar.appendChild(colorInput);
    toolbar.appendChild(app.Dom.el("button", { className: "secondary-button", text: app.I18nService.t("toolbarColor"), attrs: { type: "button", "data-format": "color" } }));

    textarea.value = note.content;
    actions.appendChild(app.Dom.el("button", { className: "primary-button", text: app.I18nService.t("saveExit"), attrs: { type: "button", "data-main-action": "save-exit" } }));
    actions.appendChild(app.Dom.el("button", { className: "secondary-button", text: app.I18nService.t(note.isPinned ? "unpin" : "pin"), attrs: { type: "button", "data-main-action": "toggle-pin" } }));
    actions.appendChild(app.Dom.el("button", { className: "danger-button", text: app.I18nService.t("delete"), attrs: { type: "button", "data-main-action": "delete-note" } }));

    form.appendChild(title);
    form.appendChild(folderLabel);
    form.appendChild(folderSelect);
    form.appendChild(toolbar);
    form.appendChild(textarea);
    form.appendChild(app.Dom.el("p", { className: "editor-help", text: app.I18nService.t("markdownHelp") }));
    form.appendChild(actions);
    root.appendChild(form);
  }

  function render(state) {
    var root = app.Dom.qs("#mainContent");
    var note = getSelectedNote(state);
    var mode = note && app.EditorController.isEditing() ? "edit" : (note ? "view" : "empty");
    var active = document.activeElement;
    var currentEditor = app.Dom.qs(".note-editor");
    var folderSignature = state.folders.map(function (folder) {
      return folder.id + ":" + folder.name;
    }).join("|");
    var preserveFocusId = active && active.id;
    var preserveSelection = active && typeof active.selectionStart === "number" ? {
      start: active.selectionStart,
      end: active.selectionEnd
    } : null;
    if (mode === "edit" && app.EditorController.getSelection) {
      var rememberedSelection = app.EditorController.getSelection();
      if (rememberedSelection && (!preserveSelection || preserveSelection.start === preserveSelection.end)) {
        preserveSelection = rememberedSelection;
      }
      if (preserveSelection && !preserveFocusId) {
        preserveFocusId = "noteContentInput";
      }
    }
    if (mode === "edit" && renderedMode === "edit" && renderedNoteId === state.ui.selectedNoteId && renderedLocale === state.settings.locale && renderedFolderSignature === folderSignature && currentEditor && currentEditor.contains(active)) {
      return;
    }
    app.Dom.clear(root);
    renderedNoteId = state.ui.selectedNoteId;
    renderedMode = mode;
    renderedLocale = state.settings.locale;
    renderedFolderSignature = folderSignature;
    if (!note) {
      renderEmpty(root);
    } else if (mode === "edit") {
      renderEditor(root, note, state);
    } else {
      renderView(root, note, state);
    }
    if (mode === "edit" && preserveFocusId) {
      var nextActive = app.Dom.qs("#" + preserveFocusId);
      if (nextActive) {
        nextActive.focus();
        if (preserveSelection && typeof nextActive.setSelectionRange === "function") {
          nextActive.setSelectionRange(preserveSelection.start, preserveSelection.end);
          app.EditorController.rememberSelection(nextActive);
        }
      }
    }
  }

  function bind() {
    var root = app.Dom.qs("#mainContent");

    root.addEventListener("input", function (event) {
      var state = app.Store.getState();
      var noteId = state.ui.selectedNoteId;
      if (!noteId) {
        return;
      }
      if (event.target.id === "noteTitleInput") {
        app.NoteService.updateNote(noteId, { title: event.target.value });
      }
      if (event.target.id === "noteContentInput") {
        app.EditorController.rememberSelection(event.target);
        app.NoteService.updateNote(noteId, { content: event.target.value });
      }
    });

    root.addEventListener("change", function (event) {
      var state = app.Store.getState();
      if (event.target.id === "folderSelect" && state.ui.selectedNoteId) {
        app.NoteService.updateNote(state.ui.selectedNoteId, { folderId: event.target.value || null });
      }
    });

    root.addEventListener("mousedown", function (event) {
      if (event.target.closest("[data-format]")) {
        event.preventDefault();
      }
    });

    root.addEventListener("select", function (event) {
      if (event.target.id === "noteContentInput") {
        app.EditorController.rememberSelection(event.target);
      }
    }, true);
    root.addEventListener("keyup", function (event) {
      if (event.target.id === "noteContentInput") {
        app.EditorController.rememberSelection(event.target);
      }
    });
    root.addEventListener("mouseup", function (event) {
      if (event.target.id === "noteContentInput") {
        app.EditorController.rememberSelection(event.target);
      }
    });

    root.addEventListener("click", function (event) {
      var action = event.target.closest("[data-main-action]");
      var format = event.target.closest("[data-format]");
      var state = app.Store.getState();
      var noteId = state.ui.selectedNoteId;
      if (format) {
        app.EditorController.wrapSelection(format.getAttribute("data-format"), app.Dom.qs("#textColorInput").value);
        return;
      }
      if (!action) {
        return;
      }
      handleAction(action.getAttribute("data-main-action"), noteId);
    });
  }

  function handleAction(action, noteId) {
    var state = app.Store.getState();
    var note = state.notes.find(function (item) { return item.id === noteId; });
    if (action === "create-note") {
      app.NoteService.createNote(null);
      app.EditorController.enterEditMode();
      app.Toast.show(app.I18nService.t("noteCreated"));
    } else if (action === "edit") {
      app.EditorController.enterEditMode();
    } else if (action === "save-exit") {
      app.EditorController.exitEditMode();
    } else if (action === "toggle-pin" && note) {
      app.NoteService.updateNote(note.id, { isPinned: !note.isPinned });
    } else if (action === "delete-note" && note) {
      app.Modal.confirm({
        title: app.I18nService.t("confirmDeleteNoteTitle"),
        text: app.I18nService.t("confirmDeleteNoteText"),
        confirmText: app.I18nService.t("delete"),
        danger: true
      }).then(function (ok) {
        if (ok) {
          app.NoteService.deleteNote(note.id);
          app.EditorController.reset();
          app.Toast.show(app.I18nService.t("noteDeleted"));
        }
      });
    }
  }

  app.MainView = {
    bind: bind,
    render: render
  };
}(window.NotionLite));
