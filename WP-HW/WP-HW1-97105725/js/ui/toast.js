(function (app) {
  "use strict";

  var timer;

  function show(message, type) {
    var root = app.Dom.qs("#toastRoot");
    var toast = app.Dom.el("div", {
      className: "toast" + (type === "error" ? " is-error" : ""),
      text: message
    });
    app.Dom.clear(root);
    root.appendChild(toast);
    clearTimeout(timer);
    timer = setTimeout(function () {
      toast.remove();
    }, 3200);
  }

  app.Toast = {
    show: show
  };
}(window.NotionLite));
