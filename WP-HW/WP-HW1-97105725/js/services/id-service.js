(function (app) {
  "use strict";

  function createId(prefix) {
    var raw;
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      raw = window.crypto.randomUUID();
    } else {
      raw = String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    }
    return prefix + "-" + raw;
  }

  app.IdService = {
    createId: createId
  };
}(window.NotionLite));
