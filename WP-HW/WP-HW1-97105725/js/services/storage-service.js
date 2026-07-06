(function (app) {
  "use strict";

  function load() {
    try {
      var raw = window.localStorage.getItem(app.Constants.STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function save(state) {
    window.localStorage.setItem(app.Constants.STORAGE_KEY, JSON.stringify(state));
  }

  app.StorageService = {
    load: load,
    save: save
  };
}(window.NotionLite));
