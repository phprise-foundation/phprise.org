# phprise.org

Static site for the PHPRise open source foundation.

Built with Astro (`output: 'static'`), deployed to Cloudflare Workers Static Assets.

## Constraints

- **No runtime.** Every page is HTML produced at build time. There is no server, no
  SSR per request, no client state manager.
- **No client framework.** The only JavaScript is one small progressive-enhancement
  script on `/projects` for filtering. Without JS the page still works.
- **Layout is flat.** `Base.astro` holds the shell (head, header, footer, slot).
  Pages are plain `.astro` files in `src/pages`.

## Structure

```
src/
├── layouts/Base.astro        shell: <head>, header, footer, <slot />
├── components/               only things that repeat
│   ├── ProjectCard.astro
│   └── TaxonomyBadge.astro
├── pages/                    one file = one route
│   ├── index.astro
│   ├── manifesto.astro
│   ├── projects/index.astro
│   ├── projects/[slug].astro
│   ├── about.astro
│   ├── contribute.astro
│   └── 404.astro
├── data/
│   ├── curated.json          hand-written copy + taxonomy (source of truth)
│   └── projects.json         curated + GitHub metadata (generated, committed)
└── styles/main.css           tokens + layout, no framework
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | local dev server |
| `npm run build` | static build into `dist/` |
| `npm run sync` | refresh stars/dates from the GitHub org (needs `GH_TOKEN`) |
| `npm run deploy` | build and `wrangler deploy` |

The build is hermetic: it never calls the network. `npm run sync` is the only
command that talks to GitHub, and it writes `src/data/projects.json` for review.

## Deploy

```bash
npm run deploy
```

`wrangler.jsonc` serves `./dist` with `not_found_handling: "404-page"` and binds the
custom domains `phprise.org` and `www.phprise.org`.

Zone-level configuration (applied via API, not stored here):

- **Always Use HTTPS**: on.
- **Single Redirect**: `www.phprise.org/*` → `301 https://phprise.org/*`, query
  preserved.
- **`public/_headers`**: `/_astro/*` immutable for one year; security headers on
  everything.

