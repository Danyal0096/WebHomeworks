(function (app) {
  "use strict";

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function el(tagName, options) {
    var node = document.createElement(tagName);
    options = options || {};
    if (options.className) {
      node.className = options.className;
    }
    if (options.text !== undefined) {
      node.textContent = options.text;
    }
    if (options.html !== undefined) {
      node.innerHTML = options.html;
    }
    if (options.attrs) {
      Object.keys(options.attrs).forEach(function (key) {
        node.setAttribute(key, options.attrs[key]);
      });
    }
    return node;
  }

  function clear(node) {
    while (node.firstChild) {
      node.removeChild(node.firstChild);
    }
  }

  app.Dom = {
    qs: qs,
    qsa: qsa,
    el: el,
    clear: clear
  };
}(window.NotionLite));
