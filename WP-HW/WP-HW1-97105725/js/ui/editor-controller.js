(function (app) {
  "use strict";

  var editMode = false;
  var lastSelection = null;

  function isEditing() {
    return editMode;
  }

  function enterEditMode() {
    editMode = true;
    app.MainView.render(app.Store.getState());
  }

  function exitEditMode() {
    editMode = false;
    lastSelection = null;
    app.MainView.render(app.Store.getState());
  }

  function reset() {
    editMode = false;
    lastSelection = null;
  }

  function rememberSelection(textarea) {
    if (!textarea) {
      return;
    }
    lastSelection = {
      start: textarea.selectionStart,
      end: textarea.selectionEnd
    };
  }

  function getSelection() {
    return lastSelection ? {
      start: lastSelection.start,
      end: lastSelection.end
    } : null;
  }

  function wrapSelection(kind, color) {
    var textarea = app.Dom.qs("#noteContentInput");
    var state = app.Store.getState();
    var noteId = state.ui.selectedNoteId;
    var range = lastSelection || (textarea ? { start: textarea.selectionStart, end: textarea.selectionEnd } : null);
    var before;
    var selected;
    var after;
    var next;
    var prefix = "";
    var suffix = "";

    if (!textarea || !noteId || !range || range.start === range.end) {
      app.Toast.show(app.I18nService.t("selectTextHint"), "error");
      return;
    }

    if (kind === "bold") {
      prefix = "**";
      suffix = "**";
    } else if (kind === "italic") {
      prefix = "*";
      suffix = "*";
    } else if (kind === "underline") {
      prefix = "<u>";
      suffix = "</u>";
    } else if (kind === "color") {
      prefix = "<span style=\"color: " + color + "\">";
      suffix = "</span>";
    }

    before = textarea.value.slice(0, range.start);
    selected = textarea.value.slice(range.start, range.end);
    after = textarea.value.slice(range.end);
    next = before + prefix + selected + suffix + after;
    textarea.value = next;
    app.NoteService.updateNote(noteId, { content: next });
    textarea.focus();
    textarea.setSelectionRange(range.start + prefix.length, range.end + prefix.length);
    rememberSelection(textarea);
  }

  app.EditorController = {
    isEditing: isEditing,
    enterEditMode: enterEditMode,
    exitEditMode: exitEditMode,
    reset: reset,
    rememberSelection: rememberSelection,
    getSelection: getSelection,
    wrapSelection: wrapSelection
  };
}(window.NotionLite));
