(function (app) {
  "use strict";

  function close() {
    var root = app.Dom.qs("#modalRoot");
    root.classList.remove("is-open");
    app.Dom.clear(root);
  }

  function baseModal(title, text) {
    var root = app.Dom.qs("#modalRoot");
    var modal = app.Dom.el("div", { className: "modal", attrs: { role: "dialog", "aria-modal": "true" } });
    modal.appendChild(app.Dom.el("h2", { text: title }));
    if (text) {
      modal.appendChild(app.Dom.el("p", { text: text }));
    }
    app.Dom.clear(root);
    root.appendChild(modal);
    root.classList.add("is-open");
    return modal;
  }

  function confirm(options) {
    return new Promise(function (resolve) {
      var modal = baseModal(options.title, options.text);
      var row = app.Dom.el("div", { className: "button-row" });
      var cancel = app.Dom.el("button", { className: "secondary-button", text: app.I18nService.t("cancel"), attrs: { type: "button" } });
      var ok = app.Dom.el("button", { className: options.danger ? "danger-button" : "primary-button", text: options.confirmText || app.I18nService.t("confirm"), attrs: { type: "button" } });
      cancel.addEventListener("click", function () {
        close();
        resolve(false);
      });
      ok.addEventListener("click", function () {
        close();
        resolve(true);
      });
      row.appendChild(cancel);
      row.appendChild(ok);
      modal.appendChild(row);
      ok.focus();
    });
  }

  function prompt(options) {
    return new Promise(function (resolve) {
      var modal = baseModal(options.title, options.text);
      var label = app.Dom.el("label", { className: "field-label", text: options.label || app.I18nService.t("folderNamePlaceholder"), attrs: { for: "modalPromptInput" } });
      var input = app.Dom.el("input", { attrs: { id: "modalPromptInput", type: "text", placeholder: options.placeholder || "" } });
      var row = app.Dom.el("div", { className: "button-row" });
      var cancel = app.Dom.el("button", { className: "secondary-button", text: app.I18nService.t("cancel"), attrs: { type: "button" } });
      var ok = app.Dom.el("button", { className: "primary-button", text: options.confirmText || app.I18nService.t("save"), attrs: { type: "button" } });
      input.value = options.value || "";
      cancel.addEventListener("click", function () {
        close();
        resolve(null);
      });
      ok.addEventListener("click", function () {
        var value = input.value.trim();
        close();
        resolve(value || null);
      });
      input.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          ok.click();
        }
        if (event.key === "Escape") {
          cancel.click();
        }
      });
      row.appendChild(cancel);
      row.appendChild(ok);
      modal.appendChild(label);
      modal.appendChild(input);
      modal.appendChild(row);
      input.focus();
      input.select();
    });
  }

  app.Modal = {
    confirm: confirm,
    prompt: prompt,
    close: close
  };
}(window.NotionLite));
