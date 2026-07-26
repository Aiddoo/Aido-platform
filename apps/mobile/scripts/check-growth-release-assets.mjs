#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = resolve(MOBILE_ROOT, '../..');
const RELEASE_VERSION = '1.8.0';
const CAMPAIGN_ID = 'feature-discovery-2026-08';
const SCREENSHOT_ORDER = [
  'memo-ai',
  'name-search',
  'drag-organization',
  'creation-methods',
  'friends',
];
const ORGANIC_VARIANTS = ['ai', 'friends', 'organization'];

function read(path) {
  return readFileSync(resolve(REPOSITORY_ROOT, path), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertLocalizedCopy(value, path) {
  assert(value && typeof value === 'object', `${path} must be an object`);
  for (const locale of ['ko', 'en']) {
    assert(
      typeof value[locale] === 'string' && value[locale].trim(),
      `${path}.${locale} is required`,
    );
  }
}

const releasePath = `apps/mobile/store-metadata/${RELEASE_VERSION}/release.json`;
const release = JSON.parse(read(releasePath));

assert(release.schemaVersion === 1, 'release schemaVersion must be 1');
assert(release.releaseVersion === RELEASE_VERSION, `releaseVersion must be ${RELEASE_VERSION}`);
assert(release.campaignId === CAMPAIGN_ID, `campaignId must be ${CAMPAIGN_ID}`);
assertLocalizedCopy(release.positioning, 'positioning');

for (const locale of ['ko', 'en']) {
  const notes = release.patchNotes?.[locale];
  assert(
    Array.isArray(notes) && notes.length >= 4,
    `patchNotes.${locale} must lead with user-visible changes`,
  );
  assert(
    notes.every((note) => typeof note === 'string' && note.trim()),
    `patchNotes.${locale} has empty copy`,
  );
}

assert(Array.isArray(release.screenshots), 'screenshots must be an array');
assert(
  JSON.stringify(release.screenshots.map(({ id }) => id)) === JSON.stringify(SCREENSHOT_ORDER),
  `screenshots must be ordered: ${SCREENSHOT_ORDER.join(', ')}`,
);
for (const [index, screenshot] of release.screenshots.entries()) {
  assertLocalizedCopy(screenshot.headline, `screenshots[${index}].headline`);
  assertLocalizedCopy(screenshot.body, `screenshots[${index}].body`);
}

assert(
  JSON.stringify(Object.keys(release.organicVariants ?? {}).sort()) ===
    JSON.stringify([...ORGANIC_VARIANTS].sort()),
  `organicVariants must contain exactly: ${ORGANIC_VARIANTS.join(', ')}`,
);
for (const variant of ORGANIC_VARIANTS) {
  for (const locale of ['ko', 'en']) {
    const copy = release.organicVariants[variant]?.[locale];
    assert(copy && typeof copy === 'object', `organicVariants.${variant}.${locale} is required`);
    for (const field of ['title', 'subtitle', 'description', 'keywords']) {
      assert(
        typeof copy[field] === 'string' && copy[field].trim(),
        `organicVariants.${variant}.${locale}.${field} is required`,
      );
    }
  }
}

const appConfig = read('apps/mobile/app.config.ts');
assert(
  appConfig.includes(`const VERSION = '${RELEASE_VERSION}'`),
  `app.config.ts version must be ${RELEASE_VERSION}`,
);

const discoveryConfig = read(
  'apps/api/src/notification/domain/services/feature-marketing-capability.ts',
);
assert(
  discoveryConfig.includes(CAMPAIGN_ID),
  'server discovery campaign must match release metadata',
);
assert(
  discoveryConfig.includes(RELEASE_VERSION),
  'server discovery minimum app version must match release metadata',
);

const friendKo = JSON.parse(read('apps/mobile/src/shared/i18n/locales/ko/friend.json'));
const friendEn = JSON.parse(read('apps/mobile/src/shared/i18n/locales/en/friend.json'));
assert(
  friendKo.search?.placeholder === '이름 또는 Aido ID로 검색',
  'Korean friend-search copy is stale',
);
assert(
  friendEn.search?.placeholder === 'Search by name or Aido ID',
  'English friend-search copy is stale',
);

const patchNotes = read(`apps/mobile/docs/releases/${RELEASE_VERSION}.md`);
assert(
  patchNotes.includes('메모가 할 일이 되고, 친구와 함께 끝내는 투두.'),
  'patch notes positioning missing',
);
assert(patchNotes.includes('Aido ID'), 'patch notes must describe name or Aido ID search');

const checklist = read('apps/mobile/docs/growth-release-checklist.md');
for (const required of [RELEASE_VERSION, CAMPAIGN_ID, 'App Store', 'Google Play', 'rollback']) {
  assert(checklist.includes(required), `release checklist is missing ${required}`);
}

console.log(`Growth release assets are aligned for ${RELEASE_VERSION} (${CAMPAIGN_ID}).`);
