# Agent Studio Docs (HonKit)

GitBook-compatible handbook built with [HonKit](https://github.com/honkit/honkit).
Published to GitHub Pages from `main`.

## Local preview

```bash
pnpm docs:install   # once
pnpm docs:dev       # http://localhost:4000 by HonKit default — use another port if API is up
```

If port 4000 conflicts with the API:

```bash
pnpm --dir handbook exec honkit serve ./ --port 4321
```

## Build static site

```bash
pnpm docs:build
# output: handbook/_book/
```

## Theme & search

- **Theme**: HonKit default theme + custom `styles/website.css` (teal AI-factory palette)
- **Night mode / fonts**: header **A** control (built-in `fontsettings`)
- **Search**: `search-pro` full-text (default lunr/search disabled)
- **Nav**: expandable chapters, back-to-top, copy-code, flexible alert callouts

## GitHub Pages

Workflow: `.github/workflows/docs.yml`  
Site (after enabling Pages → GitHub Actions): `https://ankitparekh007.github.io/agent-studio/`
