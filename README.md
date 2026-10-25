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
│   ├── curated.json          editorial overlay (copy, featured, replacements)
│   └── projects.json         generated from the GitHub org, committed
└── styles/main.css           tokens + layout, no framework
```

### The catalog is GitHub, not a list

The build reads the public repositories of `phprise-foundation`. A new repository
appears on the next build; nothing here needs editing.

Each repository declares itself through **topics**:

| Topic | Meaning |
|---|---|
| `phprise-atom` | atomic repository |
| `phprise-assembly` | assembly repository |
| `phprise-application` | application repository |
| `phprise-template` | template repository |
| `deprecated` / `abandoned` | show the deprecation badge |
| `phprise-ignore` | keep out of the catalog |

`curated.json` is an **overlay only**: it improves copy, marks `featured`, and
carries the replacement link (`replacedBy`, `replacedByUrl`) — things GitHub cannot
express. An overlay entry that matches no repository only produces a warning; it
never hides a repository.

### Deprecating a project

The canonical declaration lives in the repository (`"abandoned"` in `composer.json`,
README banner, `deprecated` topic). The site mirrors it:

```json
{ "slug": "stone-sdk", "deprecated": true, "replacedBy": "phprise/sdk-stone-psp", "replacedByUrl": "/projects/sdk-stone-psp" }
```

The card gets a `Deprecated` badge, the install snippet is hidden, and the detail
page shows a notice pointing at the replacement (internal route or absolute URL).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | local dev server (uses the last generated catalog) |
| `npm run build` | sync the catalog from GitHub, then build into `dist/` |
| `npm run sync` | refresh the catalog only (stars, descriptions, new repositories) |
| `npm run deploy` | build and `wrangler deploy` |

The build is **not** hermetic by design: it reads the public repositories of the
organization. `GH_TOKEN` is optional (public data, 60 requests/hour unauthenticated;
set it in CI for headroom). If GitHub is unreachable the script keeps the last
committed `src/data/projects.json` and the build continues.

`npm run dev` does not fetch anything — run `npm run sync` when you want the catalog
refreshed locally.

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

