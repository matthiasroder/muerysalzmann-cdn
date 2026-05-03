# Müry Salzmann CDN

Static payload served from GitHub Pages, consumed by the live Squarespace site at [www.muerysalzmann.com](https://www.muerysalzmann.com).

This repo is **generated** — do not hand-edit. The source of truth lives in the private `openclaw` workspace under `projects/muerysalzmann/website/`. Regenerate with:

```bash
python3 build_cdn_authors.py
git subtree push --prefix dist origin gh-pages   # or push this repo directly
```

## Contents

- `authors/index.json` — slug → name lookup for the Squarespace `/autorinnen-und-autoren` page
- `authors/<slug>.json` — full payload per author (bio, books, events, rendered HTML fragment)
- `authors/images/<slug>.<ext>` — author portraits
- `router.js` — site-wide router loaded via Squarespace footer Code Injection
- `router.css` — styles for the rendered author content
- `_test.html` — local test harness (`MS_CDN_BASE='.'`)

## How Squarespace consumes this

`https://www.muerysalzmann.com/autoren-detail?a=<slug>` → router fetches `<this CDN>/authors/<slug>.json` → injects `rendered_html` into `#ms-author-mount`.

See `SQUARESPACE_SETUP.md` in the source workspace for the one-time admin steps.
