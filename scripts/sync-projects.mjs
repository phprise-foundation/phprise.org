#!/usr/bin/env node
/**
 * Build-time sync of repository metadata from GitHub.
 *
 * Reads  src/data/curated.json  (hand-written copy + taxonomy, source of truth)
 * Writes src/data/projects.json (curated + live metadata, committed)
 *
 * The site build never touches the network: it only imports projects.json.
 * Run `npm run sync` when you want fresh stars/dates.
 *
 * Auth: GH_TOKEN (already exported in ~/.bashrc). Public repos only.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ORG = 'phprise-foundation';

const token = process.env.GH_TOKEN;
if (!token) {
  console.error('GH_TOKEN is not set. Nothing was written.');
  process.exit(1);
}

const response = await fetch(
  `https://api.github.com/orgs/${ORG}/repos?per_page=100&type=public`,
  {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'phprise.org-sync',
    },
  },
);

if (!response.ok) {
  console.error(`GitHub API returned ${response.status}: ${await response.text()}`);
  process.exit(1);
}

const live = new Map(
  (await response.json()).map((repo) => [repo.name, repo]),
);

const curated = JSON.parse(
  await readFile(join(root, 'src/data/curated.json'), 'utf8'),
);

const projects = curated.map((entry) => {
  const repo = live.get(entry.slug);

  if (!repo) {
    console.warn(`! ${entry.slug}: not found in ${ORG}, keeping curated data only`);
    return { ...entry, url: null, stars: null, language: null, pushedAt: null };
  }

  return {
    ...entry,
    url: repo.html_url,
    stars: repo.stargazers_count,
    language: repo.language,
    pushedAt: repo.pushed_at,
    archived: repo.archived,
  };
});

await writeFile(
  join(root, 'src/data/projects.json'),
  `${JSON.stringify(projects, null, 2)}\n`,
);

console.log(`synced ${projects.length} projects from ${ORG}`);
console.log(`written to src/data/projects.json`);
