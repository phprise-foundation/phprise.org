#!/usr/bin/env node
/**
 * Build-time catalog sync.
 *
 * GitHub is the source of truth. This script reads the public repositories of the
 * organization and derives the catalog from them:
 *
 *   - taxonomy  <- topic  "phprise-atom" | "-assembly" | "-application" | "-template"
 *   - deprecated <- topic "deprecated" | "abandoned"
 *   - title/summary <- curated overlay when present, otherwise the repository itself
 *
 * Create a repository today, rebuild, and it appears on the site.
 * `src/data/curated.json` is only an overlay for better copy — never a whitelist.
 *
 * Network failure keeps the previous src/data/projects.json (warning, exit 0).
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'src/data/projects.json');
const ORG = 'phprise-foundation';

const TAXONOMY_ORDER = ['atom', 'assembly', 'application', 'template', 'uncategorized'];
const TAXONOMY_TOPIC = {
  'phprise-atom': 'atom',
  'phprise-assembly': 'assembly',
  'phprise-application': 'application',
  'phprise-template': 'template',
};

const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';

function titleCase(slug) {
  return slug
    .split('-')
    .map((part) => (part.length <= 3 ? part.toUpperCase() : part[0].toUpperCase() + part.slice(1)))
    .join(' ');
}

function taxonomyOf(topics, overlay) {
  for (const [topic, shape] of Object.entries(TAXONOMY_TOPIC)) {
    if (topics.includes(topic)) return shape;
  }
  return overlay?.taxonomy ?? 'uncategorized';
}

function kindOf(topics, taxonomy, description, overlay) {
  if (overlay?.kind) return overlay.kind;
  if (taxonomy === 'application') return 'app';
  if (taxonomy === 'template') return 'template';
  if (/\bSDK\b/i.test(description ?? '')) return 'sdk';
  return 'library';
}

async function fetchRepos() {
  const repos = [];
  let page = 1;

  for (;;) {
    const response = await fetch(
      `https://api.github.com/orgs/${ORG}/repos?per_page=100&type=public&page=${page}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'phprise.org-build',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
    );

    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
    }

    const batch = await response.json();
    repos.push(...batch);
    if (batch.length < 100) return repos;
    page += 1;
  }
}

const overlayList = JSON.parse(
  await readFile(join(root, 'src/data/curated.json'), 'utf8'),
);
const overlayBySlug = new Map(overlayList.map((entry) => [entry.slug, entry]));

let repos;
try {
  repos = await fetchRepos();
} catch (error) {
  console.warn(`! GitHub unavailable (${error.message})`);
  try {
    await readFile(OUT);
    console.warn('! keeping the existing src/data/projects.json');
    process.exit(0);
  } catch {
    console.error('! no cached catalog and no network: cannot build');
    process.exit(1);
  }
}

const seen = new Set();

const projects = repos
  .filter((repo) => !(repo.topics ?? []).includes('phprise-ignore'))
  .map((repo) => {
    const slug = repo.name;
    const overlay = overlayBySlug.get(slug);
    seen.add(slug);

    const topics = repo.topics ?? [];
    const taxonomy = taxonomyOf(topics, overlay);
    const description = repo.description ?? '';
    const kind = kindOf(topics, taxonomy, description, overlay);
    const deprecatedByTopic = topics.includes('deprecated') || topics.includes('abandoned');
    const deprecated = overlay?.deprecated ?? deprecatedByTopic;
    const isPackage = repo.language === 'PHP' && kind !== 'app' && kind !== 'template';

    return {
      slug,
      package: overlay?.package !== undefined ? overlay.package : isPackage ? `phprise/${slug}` : null,
      title: overlay?.title ?? titleCase(slug),
      summary: overlay?.summary ?? (description || 'No description yet.'),
      taxonomy,
      kind,
      featured: overlay?.featured ?? false,
      deprecated: Boolean(deprecated),
      replacedBy: overlay?.replacedBy ?? null,
      replacedByUrl: overlay?.replacedByUrl ?? null,
      deprecationNote: overlay?.deprecationNote ?? null,
      url: repo.html_url,
      stars: repo.stargazers_count,
      language: repo.language,
      pushedAt: repo.pushed_at,
      archived: repo.archived,
      topics,
    };
  })
  .sort((a, b) => {
    const shape = TAXONOMY_ORDER.indexOf(a.taxonomy) - TAXONOMY_ORDER.indexOf(b.taxonomy);
    return shape !== 0 ? shape : a.title.localeCompare(b.title);
  });

for (const slug of overlayBySlug.keys()) {
  if (!seen.has(slug)) {
    console.warn(`! overlay entry "${slug}" does not match any public repository (ignored)`);
  }
}

await writeFile(OUT, `${JSON.stringify(projects, null, 2)}\n`);

const shapeCount = projects.reduce((acc, project) => {
  acc[project.taxonomy] = (acc[project.taxonomy] ?? 0) + 1;
  return acc;
}, {});

console.log(`catalog: ${projects.length} repositories from ${ORG}`);
console.log(`shapes: ${Object.entries(shapeCount).map(([k, v]) => `${k}=${v}`).join(' ')}`);
console.log(`deprecated: ${projects.filter((p) => p.deprecated).map((p) => p.slug).join(', ') || 'none'}`);
