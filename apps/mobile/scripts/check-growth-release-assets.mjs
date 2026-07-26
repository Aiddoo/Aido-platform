#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPOSITORY_ROOT = resolve(MOBILE_ROOT, '../..');
const RELEASE_VERSION = '1.8.0';
const CAMPAIGN_ID = 'feature-discovery-2026-08';
const CAMPAIGN_LAUNCHED_AT = '2026-08-01T00:00:00.000Z';
const SCREENSHOT_ORDER = [
  'memo-ai',
  'name-search',
  'drag-organization',
  'creation-methods',
  'friends',
];
const ORGANIC_VARIANTS = ['ai', 'friends', 'organization'];
const STORE_COPY_LIMITS = {
  title: 30,
  subtitle: 30,
  keywords: 100,
};

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

function characterCount(value) {
  return [...value].length;
}

function visitStrings(value, visitor) {
  if (typeof value === 'string') {
    visitor(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      visitStrings(item, visitor);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      visitStrings(item, visitor);
    }
  }
}

function assertNoStaleTagCopy(value, path, pattern) {
  visitStrings(value, (copy) => {
    assert(!pattern.test(copy), `${path} has stale tag terminology: ${copy}`);
  });
}

const releasePath = `apps/mobile/store-metadata/${RELEASE_VERSION}/release.json`;
const release = JSON.parse(read(releasePath));

assert(release.schemaVersion === 1, 'release schemaVersion must be 1');
assert(release.releaseVersion === RELEASE_VERSION, `releaseVersion must be ${RELEASE_VERSION}`);
assert(release.campaignId === CAMPAIGN_ID, `campaignId must be ${CAMPAIGN_ID}`);
assert(
  release.campaignLaunchedAt === CAMPAIGN_LAUNCHED_AT,
  `campaignLaunchedAt must be ${CAMPAIGN_LAUNCHED_AT}`,
);
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
    for (const [field, limit] of Object.entries(STORE_COPY_LIMITS)) {
      assert(
        characterCount(copy[field]) <= limit,
        `organicVariants.${variant}.${locale}.${field} must be ${limit} characters or fewer`,
      );
    }
  }
}

const mobilePackage = JSON.parse(read('apps/mobile/package.json'));
assert(
  mobilePackage.version === RELEASE_VERSION,
  `package.json version must be ${RELEASE_VERSION}`,
);

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
const discoveryRegistry = read(
  'apps/mobile/src/features/feature-discovery/models/feature-discovery.registry.ts',
);
assert(
  discoveryRegistry.includes(CAMPAIGN_ID),
  'bundled discovery campaign must match release metadata',
);
assert(
  discoveryRegistry.includes(CAMPAIGN_LAUNCHED_AT),
  'bundled discovery launch time must match release metadata',
);

const friendKo = JSON.parse(read('apps/mobile/src/shared/i18n/locales/ko/friend.json'));
const friendEn = JSON.parse(read('apps/mobile/src/shared/i18n/locales/en/friend.json'));
const userKo = JSON.parse(read('apps/mobile/src/shared/i18n/locales/ko/user.json'));
const userEn = JSON.parse(read('apps/mobile/src/shared/i18n/locales/en/user.json'));
const validationKo = JSON.parse(read('apps/mobile/src/shared/i18n/locales/ko/validation.json'));
const validationEn = JSON.parse(read('apps/mobile/src/shared/i18n/locales/en/validation.json'));
const discoveryKo = JSON.parse(
  read('apps/mobile/src/shared/i18n/locales/ko/featureDiscovery.json'),
);
const discoveryEn = JSON.parse(
  read('apps/mobile/src/shared/i18n/locales/en/featureDiscovery.json'),
);
assert(
  friendKo.search?.placeholder === '이름 또는 Aido ID로 검색',
  'Korean friend-search copy is stale',
);
assert(
  friendEn.search?.placeholder === 'Search by name or Aido ID',
  'English friend-search copy is stale',
);
for (const [path, catalog] of [
  ['friend.ko.search', friendKo.search],
  ['user.ko.profile', userKo.profile],
  ['validation.ko.userTag', validationKo.userTag],
  ['featureDiscovery.ko.cards.friendSearch', discoveryKo.cards?.friendSearch],
]) {
  assertNoStaleTagCopy(catalog, path, /태그/u);
}
for (const [path, catalog] of [
  ['friend.en.search', friendEn.search],
  ['user.en.profile', userEn.profile],
  ['validation.en.userTag', validationEn.userTag],
  ['featureDiscovery.en.cards.friendSearch', discoveryEn.cards?.friendSearch],
]) {
  assertNoStaleTagCopy(catalog, path, /\btags?\b/iu);
}
for (const [path, copy] of [
  ['user.ko.profile.tagCopied', userKo.profile?.tagCopied],
  ['user.ko.profile.tagCopiedDescription', userKo.profile?.tagCopiedDescription],
  ['user.en.profile.tagCopied', userEn.profile?.tagCopied],
  ['user.en.profile.tagCopiedDescription', userEn.profile?.tagCopiedDescription],
  ['validation.ko.userTag.length', validationKo.userTag?.length],
  ['validation.ko.userTag.pattern', validationKo.userTag?.pattern],
  ['validation.en.userTag.length', validationEn.userTag?.length],
  ['validation.en.userTag.pattern', validationEn.userTag?.pattern],
]) {
  assert(
    typeof copy === 'string' && copy.includes('Aido ID'),
    `${path} must use the Aido ID product term`,
  );
}

const followController = read('apps/api/src/follow/presentation/follow.controller.ts');
assert(
  !/(사용자 태그|이름 또는 태그|태그로 검색|태그로 구분)/u.test(followController),
  'follow.controller.ts has stale tag terminology',
);
assert(
  followController.includes('사용자 검색 (이름 또는 Aido ID)'),
  'follow.controller.ts must describe name or Aido ID search',
);
assert(
  followController.includes('친구 요청을 보낼 대상 Aido ID'),
  'follow.controller.ts must describe direct add with Aido ID',
);

const followValidator = read('packages/validators/src/domains/follow/follow.request.ts');
assert(
  !followValidator.includes('검색어: 이름 또는 사용자 태그'),
  'follow.request.ts has stale tag terminology',
);
assert(
  followValidator.includes('검색어: 이름 또는 Aido ID'),
  'follow.request.ts must describe name or Aido ID search',
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
