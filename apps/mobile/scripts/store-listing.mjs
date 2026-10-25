#!/usr/bin/env node
// 스토어 등록 정보(store-metadata/listing)를 검사하고, 붙여 넣기용 텍스트·검토용 Markdown으로 내보낸다.
//
//   node scripts/store-listing.mjs check
//   node scripts/store-listing.mjs export --out <폴더>   # <폴더>/text/…txt, <폴더>/*.ko-en.md
//
// 폴더 구조는 fastlane deliver/supply의 필드 파일 이름을 따른다(listing/<store>/<locale>/<field>.txt).
// en-GB처럼 일부 필드만 있는 로캘은 INHERITS의 부모 로캘에서 나머지를 물려받는다.
import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LISTING_ROOT = join(MOBILE_ROOT, 'store-metadata/listing');
export const RELEASE_VERSION = '1.13.0';

// 한도 출처: App Store Connect 도움말(platform-version-information, app-information),
// Play Console 도움말(9859152, 9866151). keywords는 Apple 문서상 100바이트지만 App Store Connect는
// 한글 100자를 받아 왔으므로 글자 수로 막고 바이트 초과는 경고로 남긴다.
export const STORES = {
  'app-store': {
    label: 'App Store',
    locales: ['ko', 'en-US', 'en-GB'],
    pairs: [['ko', 'en-US']],
    inherits: { 'en-GB': 'en-US' },
    overridable: ['keywords'],
    fields: {
      name: { label: '이름', max: 30, required: true },
      subtitle: { label: '부제', max: 30, required: true },
      promotional_text: { label: '홍보 문구', max: 170, required: true },
      description: { label: '설명', max: 4000, required: true },
      keywords: { label: '키워드', max: 100, required: true, keywords: true },
      release_notes: {
        label: `이 버전의 새로운 기능 (${RELEASE_VERSION})`,
        max: 4000,
        required: true,
      },
      support_url: { label: '지원 URL', url: true, required: true },
      marketing_url: { label: '마케팅 URL', url: true, required: true },
    },
    forbidden: [/Google Play/u, /갤럭시|Galaxy/iu],
  },
  'google-play': {
    label: 'Google Play',
    locales: ['ko-KR', 'en-US'],
    pairs: [['ko-KR', 'en-US']],
    inherits: {},
    overridable: [],
    fields: {
      title: { label: '앱 이름', max: 30, required: true, promoPolicy: true },
      short_description: { label: '간단한 설명', max: 80, required: true, promoPolicy: true },
      full_description: { label: '자세한 설명', max: 4000, required: true },
      release_notes: { label: `출시 노트 (${RELEASE_VERSION})`, max: 500, required: true },
    },
    forbidden: [/App Store|Apple 계정|Apple Account|iTunes|iPhone Duo/u],
  },
};

// Play 메타데이터 정책: 앱 이름·짧은 설명에 순위·가격·기간 한정 표현을 쓰지 않는다.
const PLAY_PROMO_WORDS =
  /\b(best|top|#1|new|free|sale|discount)\b|최고|1위|무료|신규|할인|이벤트/iu;
const STALE_TERMS = [
  { pattern: /\bPro\b/u, message: '"Pro" 대신 앱과 같은 "프리미엄/Premium"을 쓴다' },
  { pattern: /iTunes/u, message: '"iTunes 계정" 대신 "Apple 계정/Apple Account"를 쓴다' },
];

export const characterCount = (value) => [...value].length;
export const byteCount = (value) => Buffer.byteLength(value, 'utf8');
const languageOf = (locale) => locale.slice(0, 2);
const stripUrls = (value) => value.replace(/https?:\/\/\S+/gu, '');

function readField(store, locale, field) {
  const path = join(LISTING_ROOT, store, locale, `${field}.txt`);
  if (!existsSync(path)) {
    return null;
  }
  return readFileSync(path, 'utf8').replace(/\n$/u, '');
}

export function loadListing(store, locale) {
  const config = STORES[store];
  const parent = config.inherits[locale];
  const own = Object.fromEntries(
    Object.keys(config.fields)
      .map((field) => [field, readField(store, locale, field)])
      .filter(([, value]) => value != null),
  );
  if (parent == null) {
    return { values: own, inherited: [] };
  }
  const base = loadListing(store, parent).values;
  return {
    values: { ...base, ...own },
    inherited: Object.keys(base).filter((field) => !(field in own)),
  };
}

function readRelease() {
  const path = join(MOBILE_ROOT, `store-metadata/${RELEASE_VERSION}/release.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function keywordProblems(keywords, { name = '', subtitle = '' }) {
  const problems = [];
  const warnings = [];
  if (/,\s|\s,/u.test(keywords)) {
    problems.push('쉼표 앞뒤에 공백이 있다');
  }
  const items = keywords.split(',');
  if (items.some((item) => !item.trim())) {
    problems.push('빈 키워드가 있다');
  }
  const seen = new Set();
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      problems.push(`중복 키워드: ${item}`);
    }
    seen.add(key);
    // Apple: 키워드는 두 글자보다 길어야 하고, CPP에는 이 조건을 지킨 키워드만 배정된다.
    if (characterCount(item) <= 2) {
      problems.push(`3글자 미만 키워드: ${item}`);
    }
  }
  // 이름·부제의 단어는 이미 검색 대상이라 키워드에서 빼야 한다.
  const titleWords = new Set(
    `${name} ${subtitle}`
      .toLowerCase()
      .split(/[\s\-&,·]+/u)
      .filter((word) => word.length > 1),
  );
  for (const item of items) {
    if (titleWords.has(item.toLowerCase())) {
      problems.push(`이름·부제와 겹치는 키워드: ${item}`);
    }
  }
  if (byteCount(keywords) > 100) {
    warnings.push(
      `UTF-8 ${byteCount(keywords)}바이트(문서상 100바이트, App Store Connect는 글자 수 기준으로 받아 왔다)`,
    );
  }
  return { problems, warnings };
}

export function checkListings() {
  const errors = [];
  const warnings = [];
  const release = readRelease();

  for (const [store, config] of Object.entries(STORES)) {
    const loaded = {};
    for (const locale of config.locales) {
      const dir = join(LISTING_ROOT, store, locale);
      if (!existsSync(dir)) {
        errors.push(`${store}/${locale}: 폴더가 없다`);
        continue;
      }
      const known = new Set(Object.keys(config.fields).map((field) => `${field}.txt`));
      for (const file of readdirSync(dir)) {
        if (!known.has(file)) {
          errors.push(`${store}/${locale}/${file}: 알 수 없는 필드 파일`);
        }
      }
      if (config.inherits[locale] != null) {
        for (const file of readdirSync(dir)) {
          const field = file.replace(/\.txt$/u, '');
          if (!config.overridable.includes(field)) {
            errors.push(
              `${store}/${locale}/${file}: 물려받는 로캘은 ${config.overridable.join(', ')}만 바꾼다`,
            );
          }
        }
      }
      const { values } = loadListing(store, locale);
      loaded[locale] = values;
      const at = (field) => `${store}/${locale}/${field}`;
      const language = languageOf(locale);

      for (const [field, rule] of Object.entries(config.fields)) {
        const value = values[field];
        if (value == null || !value.trim()) {
          if (rule.required) {
            errors.push(`${at(field)}: 비어 있다`);
          }
          continue;
        }
        if (value !== value.trim()) {
          errors.push(`${at(field)}: 앞뒤 공백`);
        }
        if (rule.max != null && characterCount(value) > rule.max) {
          errors.push(`${at(field)}: ${characterCount(value)}자 > ${rule.max}자`);
        }
        if (rule.url && !/^https:\/\/\S+$/u.test(value)) {
          errors.push(`${at(field)}: https URL이어야 한다`);
        }
        if (rule.url && !value.endsWith(`/${language}`)) {
          errors.push(`${at(field)}: /${language} 경로여야 한다`);
        }
        if (rule.keywords) {
          const result = keywordProblems(value, values);
          errors.push(...result.problems.map((problem) => `${at(field)}: ${problem}`));
          warnings.push(...result.warnings.map((warning) => `${at(field)}: ${warning}`));
        }
        if (rule.promoPolicy && PLAY_PROMO_WORDS.test(value)) {
          errors.push(`${at(field)}: Play 메타데이터 정책상 쓰지 않는 홍보 표현이 있다`);
        }
        for (const { pattern, message } of STALE_TERMS) {
          if (pattern.test(value)) {
            errors.push(`${at(field)}: ${message}`);
          }
        }
        for (const pattern of config.forbidden) {
          if (pattern.test(value)) {
            errors.push(`${at(field)}: 다른 스토어 표현이 있다 (${pattern})`);
          }
        }
        const prose = stripUrls(value);
        if (language === 'ko' && /Aido/u.test(prose)) {
          errors.push(`${at(field)}: 한국어 문구의 브랜드는 "아이두"로 쓴다`);
        }
        if (language === 'en' && /[가-힣]/u.test(prose)) {
          errors.push(`${at(field)}: 영어 문구에 한글이 있다`);
        }
      }

      // 업데이트 내용은 release.json 항목을 모두 담아야 한다(같은 순서).
      const notes = values.release_notes ?? '';
      const expected = release.patchNotes?.[language] ?? [];
      const bullets = notes
        .split('\n')
        .filter((line) => line.startsWith('- '))
        .map((line) => line.slice(2));
      if (JSON.stringify(bullets) !== JSON.stringify(expected)) {
        errors.push(
          `${at('release_notes')}: ${RELEASE_VERSION}/release.json의 ${language} 항목과 다르다`,
        );
      }
    }

    // ko/en 필드 짝 맞추기
    for (const [left, right] of config.pairs) {
      const a = Object.keys(loaded[left] ?? {}).sort();
      const b = Object.keys(loaded[right] ?? {}).sort();
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        errors.push(`${store}: ${left}(${a.join(',')})와 ${right}(${b.join(',')})의 필드가 다르다`);
      }
    }
  }

  // 두 스토어의 같은 언어 업데이트 내용은 같아야 한다.
  for (const [appStore, play] of [
    ['ko', 'ko-KR'],
    ['en-US', 'en-US'],
  ]) {
    const a = loadListing('app-store', appStore).values.release_notes;
    const b = loadListing('google-play', play).values.release_notes;
    if (a !== b) {
      errors.push(`release_notes: app-store/${appStore}와 google-play/${play}가 다르다`);
    }
  }
  errors.push(...customProductPageProblems());
  return { errors, warnings };
}

// 맞춤형 제품 페이지 키워드는 같은 로캘 키워드 필드에 있어야 하고 페이지끼리 겹치지 않는다.
export function customProductPageProblems() {
  const path = join(LISTING_ROOT, 'app-store/custom-product-pages.json');
  const { pages } = JSON.parse(readFileSync(path, 'utf8'));
  const problems = [];
  const used = new Map();
  for (const [pageId, page] of Object.entries(pages)) {
    for (const [locale, keywords] of Object.entries(page.keywords)) {
      const field = new Set((loadListing('app-store', locale).values.keywords ?? '').split(','));
      for (const keyword of keywords) {
        if (!field.has(keyword)) {
          problems.push(
            `custom-product-pages.${pageId}.${locale}: "${keyword}"가 keywords.txt에 없다`,
          );
        }
        const key = `${locale}:${keyword}`;
        if (used.has(key)) {
          problems.push(
            `custom-product-pages.${pageId}.${locale}: "${keyword}"가 ${used.get(key)}와 겹친다`,
          );
        }
        used.set(key, pageId);
      }
    }
  }
  return problems;
}

function fieldRows(store) {
  const config = STORES[store];
  return Object.entries(config.fields).map(([field, rule]) => ({ field, rule }));
}

function countLabel(value, rule) {
  if (rule.url) {
    return 'URL';
  }
  const chars = characterCount(value);
  const bytes = rule.keywords ? ` · ${byteCount(value)}바이트` : '';
  return `${chars}${rule.max != null ? `/${rule.max}` : ''}자${bytes}`;
}

function markdownFor(store) {
  const config = STORES[store];
  const [left, right] = config.pairs[0];
  const extra = config.locales.filter((locale) => locale !== left && locale !== right);
  const a = loadListing(store, left).values;
  const b = loadListing(store, right).values;
  const lines = [
    `# 아이두 ${config.label} 등록 정보 ${RELEASE_VERSION} (${left} · ${right})`,
    '',
    `원본: Aido-platform \`apps/mobile/store-metadata/listing/${store}/\` (브랜치 chore/${RELEASE_VERSION}-release).`,
    '`pnpm --filter @aido/mobile store:export --out <폴더>`로 다시 만든다. 글자 수는 유니코드 글자 기준이다.',
    '',
    `| 필드 | ${left} | ${right} |`,
    '| --- | --- | --- |',
  ];
  const short = fieldRows(store).filter(({ rule }) => rule.url || (rule.max ?? 0) <= 170);
  const long = fieldRows(store).filter(({ rule }) => !(rule.url || (rule.max ?? 0) <= 170));
  const cell = (value) => value.replaceAll('|', '\\|').replaceAll('\n', '<br>');
  for (const { field, rule } of short) {
    lines.push(
      `| ${rule.label} | ${cell(a[field])}<br>**${countLabel(a[field], rule)}** | ${cell(b[field])}<br>**${countLabel(b[field], rule)}** |`,
    );
  }
  for (const locale of extra) {
    const { values, inherited } = loadListing(store, locale);
    const own = Object.keys(values).filter((field) => !inherited.includes(field));
    lines.push(
      '',
      `## ${locale}`,
      '',
      `${config.inherits[locale]}에서 물려받고 아래만 바꾼다.`,
      '',
    );
    for (const field of own) {
      const rule = config.fields[field];
      lines.push(`- ${rule.label} (${countLabel(values[field], rule)}): \`${values[field]}\``);
    }
  }
  for (const { field, rule } of long) {
    lines.push('', `## ${rule.label}`, '');
    for (const [locale, values] of [
      [left, a],
      [right, b],
    ]) {
      lines.push(
        `### ${locale} — ${countLabel(values[field], rule)}`,
        '',
        '```text',
        values[field],
        '```',
        '',
      );
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

export function exportListings(outDir) {
  const written = [];
  for (const [store, config] of Object.entries(STORES)) {
    for (const locale of config.locales) {
      const { values } = loadListing(store, locale);
      const dir = join(outDir, 'text', store, locale);
      mkdirSync(dir, { recursive: true });
      for (const [field, value] of Object.entries(values)) {
        writeFileSync(join(dir, `${field}.txt`), value);
        written.push(join(dir, `${field}.txt`));
      }
    }
  }
  const names = {
    'app-store': 'App-Store-등록정보.ko-en.md',
    'google-play': 'Google-Play-등록정보.ko-en.md',
  };
  for (const [store, file] of Object.entries(names)) {
    writeFileSync(join(outDir, file), markdownFor(store));
    written.push(join(outDir, file));
  }
  return written;
}

function report() {
  for (const [store, config] of Object.entries(STORES)) {
    for (const locale of config.locales) {
      const { values, inherited } = loadListing(store, locale);
      for (const [field, rule] of Object.entries(config.fields)) {
        if (values[field] == null || inherited.includes(field)) {
          continue;
        }
        console.log(`${store}/${locale}/${field}: ${countLabel(values[field], rule)}`);
      }
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { positionals, values } = parseArgs({
    // pnpm이 넘기는 `--` 구분자는 버린다.
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
    allowPositionals: true,
    options: { out: { type: 'string' }, quiet: { type: 'boolean', default: false } },
  });
  const command = positionals[0] ?? 'check';
  const { errors, warnings } = checkListings();
  if (!values.quiet) {
    report();
  }
  for (const warning of warnings) {
    console.warn(`경고: ${warning}`);
  }
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`오류: ${error}`);
    }
    process.exit(1);
  }
  if (command === 'export') {
    if (values.out == null) {
      throw new Error('--out <폴더>가 필요하다');
    }
    const written = exportListings(resolve(values.out));
    console.log(`내보냄: ${written.length}개 파일 → ${resolve(values.out)}`);
  } else if (command !== 'check') {
    throw new Error(`알 수 없는 명령: ${command}`);
  }
  console.log('스토어 등록 정보 검사 통과');
}
