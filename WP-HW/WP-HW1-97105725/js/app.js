(function (app) {
  "use strict";

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
  }

  function updateChrome(state) {
    app.I18nService.applyDocumentLocale(state.settings.locale);
    applyTheme(state.settings.theme);
    document.title = app.I18nService.t("pageTitle");
    app.I18nService.localizeStatic();
    app.Dom.qs("[data-action='toggle-theme']").textContent = app.I18nService.t(state.settings.theme === "dark" ? "toggleThemeLight" : "toggleTheme");
    app.Dom.qs("[data-action='toggle-locale']").textContent = app.I18nService.t("toggleLanguage");
  }

  function start() {
    app.SidebarView.bind();
    app.MainView.bind();
    app.Store.subscribe(function (state) {
      updateChrome(state);
      app.SidebarView.render(state);
      app.MainView.render(state);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
}(window.NotionLite));
