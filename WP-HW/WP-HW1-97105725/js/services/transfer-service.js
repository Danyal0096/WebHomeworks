(function (app) {
  "use strict";

  function exportState() {
    var state = app.Store.getState();
    var date = new Date().toISOString().slice(0, 10);
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "notion-lite-export-" + date + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 0);
  }

  function readJsonFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          resolve(JSON.parse(String(reader.result || "")));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = function () {
        reject(reader.error);
      };
      reader.readAsText(file);
    });
  }

  app.TransferService = {
    exportState: exportState,
    readJsonFile: readJsonFile
  };
}(window.NotionLite));
