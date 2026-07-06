(function (app) {
  "use strict";

  app.Constants = {
    STORAGE_KEY: "notionLite.state.v1",
    SCHEMA_VERSION: 1,
    LOCALES: ["fa", "en"],
    THEMES: ["light", "dark"],
    SORT_MODES: ["updated-desc", "created-desc", "title-asc"]
  };
}(window.NotionLite));
