import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(new URL('./check-growth-release-assets.mjs', import.meta.url));
const RELEASE_VERSION = '1.8.0';
const CAMPAIGN_ID = 'feature-discovery-2026-08';
const CAMPAIGN_LAUNCHED_AT = '2026-08-01T00:00:00.000Z';

const validRelease = () => ({
  schemaVersion: 1,
  releaseVersion: RELEASE_VERSION,
  campaignId: CAMPAIGN_ID,
  campaignLaunchedAt: CAMPAIGN_LAUNCHED_AT,
  positioning: {
    ko: '메모가 할 일이 되고, 친구와 함께 끝내는 투두.',
    en: 'Turn notes into to-dos, then finish them with friends.',
  },
  patchNotes: {
    ko: ['첫 번째 변경', '두 번째 변경', '세 번째 변경', '네 번째 변경'],
    en: ['First change', 'Second change', 'Third change', 'Fourth change'],
  },
  screenshots: ['memo-ai', 'name-search', 'drag-organization', 'creation-methods', 'friends'].map(
    (id) => ({
      id,
      headline: { ko: `${id} 제목`, en: `${id} title` },
      body: { ko: `${id} 설명`, en: `${id} description` },
    }),
  ),
  organicVariants: Object.fromEntries(
    ['ai', 'friends', 'organization'].map((variant) => [
      variant,
      {
        ko: {
          title: 'Aido 기능',
          subtitle: '기능을 바로 만나보세요',
          description: `${variant} 기능 설명`,
          keywords: '할일,생산성',
        },
        en: {
          title: 'Aido Features',
          subtitle: 'Meet useful features',
          description: `${variant} feature description`,
          keywords: 'todo,productivity',
        },
      },
    ]),
  ),
});

const validPublicCopy = () => ({
  friendKo: { search: { placeholder: '이름 또는 Aido ID로 검색' } },
  friendEn: { search: { placeholder: 'Search by name or Aido ID' } },
  userKo: {
    profile: {
      tagCopied: 'Aido ID 복사 완료',
      tagCopiedDescription: 'Aido ID를 친구에게 공유해 보세요',
    },
  },
  userEn: {
    profile: {
      tagCopied: 'Aido ID copied',
      tagCopiedDescription: 'Share your Aido ID with friends',
    },
  },
  validationKo: {
    userTag: {
      length: 'Aido ID는 8자리입니다',
      pattern: 'Aido ID는 영문 대문자와 숫자만 사용할 수 있어요',
    },
  },
  validationEn: {
    userTag: {
      length: 'Aido IDs are 8 characters long',
      pattern: 'Aido IDs can only contain uppercase letters and numbers',
    },
  },
  discoveryKo: {
    cards: { friendSearch: { description: '친구 이름이나 Aido ID로 바로 찾을 수 있어요.' } },
  },
  discoveryEn: {
    cards: { friendSearch: { description: "Search by a friend's name or Aido ID." } },
  },
  followController: `
    description: "친구 요청을 보낼 대상 Aido ID"
    description: "Aido ID로 검색"
    summary: "사용자 검색 (이름 또는 Aido ID)"
    description: "이름 또는 Aido ID로 전체 사용자를 검색합니다."
  `,
  followValidator: `.describe('검색어: 이름 또는 Aido ID (2-50자)')`,
});

function write(root, relativePath, contents) {
  const path = resolve(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents);
}

function writeJson(root, relativePath, value) {
  write(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function createFixture({ mutateRelease, mutateCopy, packageVersion = RELEASE_VERSION } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'aido-release-assets-'));
  const release = validRelease();
  const publicCopy = validPublicCopy();
  mutateRelease?.(release);
  mutateCopy?.(publicCopy);

  const fixtureScript = resolve(root, 'apps/mobile/scripts/check-growth-release-assets.mjs');
  mkdirSync(dirname(fixtureScript), { recursive: true });
  cpSync(SCRIPT_PATH, fixtureScript);

  writeJson(root, `apps/mobile/store-metadata/${RELEASE_VERSION}/release.json`, release);
  writeJson(root, 'apps/mobile/package.json', {
    name: '@aido/mobile',
    version: packageVersion,
  });
  write(root, 'apps/mobile/app.config.ts', `const VERSION = '${RELEASE_VERSION}';\n`);
  write(
    root,
    'apps/api/src/notification/domain/services/feature-marketing-capability.ts',
    `${CAMPAIGN_ID}\n${RELEASE_VERSION}\n`,
  );
  write(
    root,
    'apps/mobile/src/features/feature-discovery/models/feature-discovery.registry.ts',
    `${CAMPAIGN_ID}\n${CAMPAIGN_LAUNCHED_AT}\n`,
  );
  writeJson(root, 'apps/mobile/src/shared/i18n/locales/ko/friend.json', publicCopy.friendKo);
  writeJson(root, 'apps/mobile/src/shared/i18n/locales/en/friend.json', publicCopy.friendEn);
  writeJson(root, 'apps/mobile/src/shared/i18n/locales/ko/user.json', publicCopy.userKo);
  writeJson(root, 'apps/mobile/src/shared/i18n/locales/en/user.json', publicCopy.userEn);
  writeJson(
    root,
    'apps/mobile/src/shared/i18n/locales/ko/validation.json',
    publicCopy.validationKo,
  );
  writeJson(
    root,
    'apps/mobile/src/shared/i18n/locales/en/validation.json',
    publicCopy.validationEn,
  );
  writeJson(
    root,
    'apps/mobile/src/shared/i18n/locales/ko/featureDiscovery.json',
    publicCopy.discoveryKo,
  );
  writeJson(
    root,
    'apps/mobile/src/shared/i18n/locales/en/featureDiscovery.json',
    publicCopy.discoveryEn,
  );
  write(root, 'apps/api/src/follow/presentation/follow.controller.ts', publicCopy.followController);
  write(
    root,
    'packages/validators/src/domains/follow/follow.request.ts',
    publicCopy.followValidator,
  );
  write(
    root,
    `apps/mobile/docs/releases/${RELEASE_VERSION}.md`,
    '메모가 할 일이 되고, 친구와 함께 끝내는 투두.\nAido ID\n',
  );
  write(
    root,
    'apps/mobile/docs/growth-release-checklist.md',
    `${RELEASE_VERSION}\n${CAMPAIGN_ID}\nApp Store\nGoogle Play\nrollback\n`,
  );

  return root;
}

function runChecker(root) {
  return spawnSync(process.execPath, ['apps/mobile/scripts/check-growth-release-assets.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
}

function withFixture(options, assertion) {
  const root = createFixture(options);
  try {
    assertion(runChecker(root));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('정합한 릴리스 자산은 검사에 통과한다', () => {
  withFixture({}, (result) => {
    assert.equal(result.status, 0, result.stderr);
  });
});

for (const [field, value, expectedMessage] of [
  ['title', 'x'.repeat(31), 'title must be 30 characters or fewer'],
  ['subtitle', 'x'.repeat(31), 'subtitle must be 30 characters or fewer'],
  ['keywords', 'x'.repeat(101), 'keywords must be 100 characters or fewer'],
]) {
  test(`스토어 ${field} 글자 수 제한을 넘으면 거부한다`, () => {
    withFixture(
      {
        mutateRelease: (release) => {
          release.organicVariants.friends.en[field] = value;
        },
      },
      (result) => {
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(expectedMessage));
      },
    );
  });
}

for (const [label, mutateCopy] of [
  [
    '프로필 복사 문구',
    (copy) => {
      copy.userKo.profile.tagCopied = '태그 복사 완료';
    },
  ],
  [
    '친구 추가 검증 문구',
    (copy) => {
      copy.validationEn.userTag.length = 'User tags are 8 characters long';
    },
  ],
  [
    '기능 가이드 문구',
    (copy) => {
      copy.discoveryKo.cards.friendSearch.description = '해시태그를 몰라도 찾을 수 있어요.';
    },
  ],
  [
    'Swagger 컨트롤러 문구',
    (copy) => {
      copy.followController = 'description: "이름 또는 사용자 태그로 검색합니다."';
    },
  ],
  [
    'Swagger 쿼리 문구',
    (copy) => {
      copy.followValidator = `.describe('검색어: 이름 또는 사용자 태그 (2-50자)')`;
    },
  ],
]) {
  test(`${label}에 구식 tag 표현이 돌아오면 거부한다`, () => {
    withFixture({ mutateCopy }, (result) => {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /stale tag terminology/);
    });
  });
}

test('모바일 package 버전이 릴리스 버전과 다르면 거부한다', () => {
  withFixture({ packageVersion: '1.7.9' }, (result) => {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /package\.json version must be 1\.8\.0/);
  });
});

test('번들 캠페인 출시 시각과 릴리스 메타데이터가 다르면 거부한다', () => {
  withFixture(
    {
      mutateRelease: (release) => {
        release.campaignLaunchedAt = '2026-08-02T00:00:00.000Z';
      },
    },
    (result) => {
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /campaignLaunchedAt must be 2026-08-01/);
    },
  );
});
