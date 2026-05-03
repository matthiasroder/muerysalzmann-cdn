/* Müry Salzmann author router.
 *
 * Loaded site-wide via Squarespace's Code Injection (Settings > Advanced >
 * Code Injection > Footer). Two responsibilities:
 *
 *   1. On the host page /autoren-detail, read ?a=<slug>, fetch the matching
 *      author payload from the CDN, and inject the rendered HTML into a known
 *      mount point (#ms-author-mount). Updates document title and meta tags
 *      so social link previews work.
 *
 *   2. On the existing index page /autorinnen-und-autoren, walk every
 *      figure.image-title and wrap each tile in <a href="/autoren-detail?a=<slug>">
 *      so visitors can click through. (Mirrors the patch_authors_index logic
 *      from build_author_pages.py, but applied at runtime.)
 *
 * The CDN base URL is set via the global window.MS_CDN_BASE — define it in
 * a small <script> tag in the same Code Injection block, before this file
 * loads. Falls back to the script tag's own src origin if not set.
 */
(function () {
  "use strict";

  var HOST_PAGE = "/autoren-detail";
  var INDEX_PAGE = "/autorinnen-und-autoren";
  var MOUNT_ID = "ms-author-mount";

  var cdnBase = (window.MS_CDN_BASE || inferBaseFromScript() || "").replace(/\/+$/, "");

  function inferBaseFromScript() {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      var src = scripts[i].src || "";
      if (src.indexOf("router.js") !== -1) {
        return src.replace(/\/router\.js(\?.*)?$/, "");
      }
    }
    return "";
  }

  function getSlug() {
    var qs = new URLSearchParams(window.location.search);
    var slug = qs.get("a");
    if (slug) return slug.trim();
    if (window.location.hash) {
      return window.location.hash.replace(/^#/, "").trim();
    }
    return "";
  }

  function setMeta(name, content, isProperty) {
    if (!content) return;
    var attr = isProperty ? "property" : "name";
    var sel = "meta[" + attr + '="' + name + '"]';
    var tag = document.head.querySelector(sel);
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute(attr, name);
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", content);
  }

  function applyMeta(record) {
    var meta = record.meta || {};
    var title = meta.title || (record.name + " · Müry Salzmann Verlag");
    document.title = title;
    setMeta("description", meta.description);
    setMeta("og:title", title, true);
    setMeta("og:description", meta.description, true);
    setMeta("og:type", "profile", true);
    setMeta("og:url", window.location.href, true);
    if (record.photo_url) {
      var img = record.photo_url;
      if (img.charAt(0) !== "/" && img.indexOf("://") === -1) {
        img = cdnBase + "/authors/" + img;
      }
      setMeta("og:image", img, true);
    }
  }

  function rewriteRelativeAssets(root) {
    // The build script embeds the author photo as a relative path
    // ("images/<slug>.jpg") so the same JSON works whether served from
    // GitHub Pages, a custom CDN, or the local test harness. The browser
    // resolves it against the *page* URL (e.g. /autoren-detail), which
    // is wrong — it must resolve against the CDN base.
    var imgs = root.querySelectorAll("img[src]");
    for (var i = 0; i < imgs.length; i++) {
      var src = imgs[i].getAttribute("src") || "";
      if (!src) continue;
      if (src.indexOf("://") !== -1) continue;          // absolute URL
      if (src.charAt(0) === "/") continue;              // site-absolute
      if (src.indexOf("data:") === 0) continue;
      imgs[i].setAttribute("src", cdnBase + "/authors/" + src);
    }
  }

  function renderAuthor(slug) {
    var mount = document.getElementById(MOUNT_ID);
    if (!mount) {
      console.warn("[ms-router] mount point #" + MOUNT_ID + " not found");
      return;
    }
    if (!slug) {
      mount.innerHTML =
        '<div class="demo-author-page"><p class="demo-empty">Kein Autor angegeben. ' +
        '<a href="' + INDEX_PAGE + '">Zur Übersicht</a></p></div>';
      return;
    }
    mount.setAttribute("data-loading", "1");
    fetch(cdnBase + "/authors/" + encodeURIComponent(slug) + ".json", {
      credentials: "omit",
      cache: "no-cache",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (record) {
        mount.innerHTML = record.rendered_html || "";
        rewriteRelativeAssets(mount);
        applyMeta(record);
        mount.removeAttribute("data-loading");
      })
      .catch(function (err) {
        console.error("[ms-router] failed to load author", slug, err);
        mount.innerHTML =
          '<div class="demo-author-page"><p class="demo-empty">' +
          'Autor:in nicht gefunden. <a href="' + INDEX_PAGE + '">Zur Übersicht</a></p></div>';
        mount.removeAttribute("data-loading");
      });
  }

  function patchIndex() {
    fetch(cdnBase + "/authors/index.json", { credentials: "omit", cache: "no-cache" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (index) {
        var slugByName = {};
        for (var i = 0; i < index.length; i++) {
          slugByName[index[i].name] = index[i].slug;
        }
        var figures = document.querySelectorAll("figure");
        for (var j = 0; j < figures.length; j++) {
          var fig = figures[j];
          if (fig.getAttribute("data-ms-linked")) continue;
          var titleEl = fig.querySelector(".image-title");
          if (!titleEl) continue;
          var name = (titleEl.textContent || "").trim();
          var slug = slugByName[name];
          if (!slug) continue;

          var wrap = document.createElement("a");
          wrap.href = HOST_PAGE + "?a=" + encodeURIComponent(slug);
          wrap.setAttribute("data-ms-linked", "1");
          wrap.style.cssText = "text-decoration:none;color:inherit;display:block;";
          while (fig.firstChild) wrap.appendChild(fig.firstChild);
          fig.appendChild(wrap);
          fig.setAttribute("data-ms-linked", "1");
        }
      })
      .catch(function (err) {
        console.error("[ms-router] failed to load author index", err);
      });
  }

  function pathStartsWith(p, prefix) {
    if (p === prefix) return true;
    return p.indexOf(prefix + "/") === 0 || p.indexOf(prefix + ".") === 0;
  }

  function route() {
    if (window.MS_FORCE_HOST_PAGE) {
      renderAuthor(getSlug());
      return;
    }
    if (window.MS_FORCE_INDEX_PAGE) {
      patchIndex();
      return;
    }
    var path = window.location.pathname.replace(/\/+$/, "") || "/";
    if (pathStartsWith(path, HOST_PAGE)) {
      renderAuthor(getSlug());
    } else if (pathStartsWith(path, INDEX_PAGE)) {
      patchIndex();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", route);
  } else {
    route();
  }

  // Squarespace AJAX-swaps page content on internal nav clicks. Re-route
  // whenever the URL changes.
  var lastPath = window.location.pathname + window.location.search;
  window.addEventListener("popstate", route);
  setInterval(function () {
    var nowPath = window.location.pathname + window.location.search;
    if (nowPath !== lastPath) {
      lastPath = nowPath;
      route();
    }
  }, 400);
})();
