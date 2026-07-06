(function (app) {
  "use strict";

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function isSafeUrl(url) {
    try {
      var parsed = new URL(url, window.location.href);
      return parsed.protocol === "http:" || parsed.protocol === "https:" || parsed.protocol === "mailto:";
    } catch (error) {
      return false;
    }
  }

  function renderInline(source) {
    var codeParts = [];
    var html = escapeHtml(source).replace(/`([^`]+)`/g, function (_, code) {
      var token = "\u0000CODE" + codeParts.length + "\u0000";
      codeParts.push("<code>" + code + "</code>");
      return token;
    });

    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, label, url) {
      var unescapedUrl = url.replace(/&amp;/g, "&").replace(/&quot;/g, "\"").trim();
      if (!isSafeUrl(unescapedUrl)) {
        return label + " (" + escapeHtml(app.I18nService.t("unsafeLink")) + ")";
      }
      return "<a href=\"" + escapeHtml(unescapedUrl) + "\" target=\"_blank\" rel=\"noopener noreferrer\">" + label + "</a>";
    });

    html = html
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/(^|[^_])_([^_]+)_/g, "$1<em>$2</em>");

    html = html
      .replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, "<u>$1</u>")
      .replace(/&lt;span\s+style=&quot;color:\s*(#[0-9a-fA-F]{6})&quot;&gt;([\s\S]*?)&lt;\/span&gt;/g, "<span style=\"color: $1\">$2</span>");

    codeParts.forEach(function (code, index) {
      html = html.replace("\u0000CODE" + index + "\u0000", code);
    });
    return html;
  }

  function closeList(context) {
    if (!context.listType) {
      return "";
    }
    var tag = context.listType;
    context.listType = null;
    return "</" + tag + ">";
  }

  function render(markdown) {
    var lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    var html = "";
    var listContext = { listType: null };
    var inCode = false;
    var codeLines = [];

    lines.forEach(function (line) {
      var headingMatch;
      var unorderedMatch;
      var orderedMatch;

      if (/^```/.test(line)) {
        if (inCode) {
          html += "<pre><code>" + escapeHtml(codeLines.join("\n")) + "</code></pre>";
          codeLines = [];
          inCode = false;
        } else {
          html += closeList(listContext);
          inCode = true;
        }
        return;
      }

      if (inCode) {
        codeLines.push(line);
        return;
      }

      if (!line.trim()) {
        html += closeList(listContext);
        return;
      }

      headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
      if (headingMatch) {
        html += closeList(listContext);
        html += "<h" + headingMatch[1].length + ">" + renderInline(headingMatch[2]) + "</h" + headingMatch[1].length + ">";
        return;
      }

      unorderedMatch = /^\s*[-*]\s+(.+)$/.exec(line);
      if (unorderedMatch) {
        if (listContext.listType !== "ul") {
          html += closeList(listContext) + "<ul>";
          listContext.listType = "ul";
        }
        html += "<li>" + renderInline(unorderedMatch[1]) + "</li>";
        return;
      }

      orderedMatch = /^\s*\d+\.\s+(.+)$/.exec(line);
      if (orderedMatch) {
        if (listContext.listType !== "ol") {
          html += closeList(listContext) + "<ol>";
          listContext.listType = "ol";
        }
        html += "<li>" + renderInline(orderedMatch[1]) + "</li>";
        return;
      }

      html += closeList(listContext);
      html += "<p>" + renderInline(line) + "</p>";
    });

    if (inCode) {
      html += "<pre><code>" + escapeHtml(codeLines.join("\n")) + "</code></pre>";
    }
    html += closeList(listContext);
    return html || "<p></p>";
  }

  app.MarkdownService = {
    render: render,
    escapeHtml: escapeHtml
  };
}(window.NotionLite));
