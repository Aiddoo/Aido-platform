#!/usr/bin/env node
// 1.13.0 스토어 아트 생성기. storyboard.mjs를 읽어 스크린샷·배너·이벤트 이미지를 만든다.
//
//   node store-metadata/art/render.mjs --out <폴더>                       # 최종본(캡처가 모두 있어야 함)
//   node store-metadata/art/render.mjs --out <폴더> --preview              # 없는 캡처는 자리표시로 미리보기
//   node store-metadata/art/render.mjs --out <폴더> --only scenes          # 캡처가 필요 없는 배너·이벤트만
//   node store-metadata/art/render.mjs captures                            # 필요한 캡처 목록과 빠진 파일
//   node store-metadata/art/render.mjs asset-names --out <파일.md>             # App Store 에셋 라이브러리 이름표
//   node store-metadata/art/render.mjs todo --out <폴더>                   # 캡처 전 업로드 폴더에 장별 TODO.md
//
// 옵션: --captures <캡처 루트>(기본 ~/Desktop/Aido-Screens-1.13.0), --only <scenes|screenshots|세트 id|대상 id>,
//       --locales ko,en. 결과 폴더에 index.html(스토리보드 갤러리)과 manifest.json을 쓴다.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import sharp from 'sharp';

import { defaultCaptureRoot, launchChrome } from './lib/chrome.mjs';
import { contrastFailures, contrastRatio } from './lib/contrast.mjs';
import {
  CAPTURE_DEVICES,
  CARD_COPY,
  KEYBOARD_SCREENS,
  LOCALES,
  RELEASE_VERSION,
  SCENES,
  SETS,
  SLOTS,
  TARGETS,
  slotCopy,
} from './storyboard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MOBILE_ROOT = resolve(HERE, '../..');
const STORE_LOCALE = {
  'app-store': { ko: 'ko', en: 'en' },
  'google-play': { ko: 'ko-KR', en: 'en-US' },
};
const ASSETS = {
  cat: pathToFileURL(join(MOBILE_ROOT, 'assets/images/ido_cat_hi.webp')).href,
  icon: pathToFileURL(join(MOBILE_ROOT, 'assets/images/icon.png')).href,
  friend: pathToFileURL(join(MOBILE_ROOT, 'assets/premium-app-icons/orange-tabby.png')).href,
  avatars: ['cat-orange-tabby.webp', 'cat-default.webp'].map(
    (file) => pathToFileURL(join(HERE, 'images', file)).href,
  ),
};
// Play: 스크린샷 8MB, 그래픽 이미지 1MB 안. Apple은 한도를 따로 두지 않지만 같은 기준으로 가볍게 둔다.
const MAX_BYTES = { screenshot: 8 * 1024 * 1024, scene: 8 * 1024 * 1024, feature: 1024 * 1024 };
// 미리보기용 초대 화면 목업 문구(앱 i18n invite.json과 같은 말)
const INVITE_MOCK = {
  ko: {
    chip: '친구도 나도 프리미엄 7일',
    title: '친구를 초대하고\n서로 할 일을 응원해요',
    codeLabel: '내 초대 코드',
    kakao: '카카오톡',
    copy: '링크 복사',
    share: '공유',
  },
  en: {
    chip: '7 days of Premium for both of you',
    title: 'Invite a friend and\ncheer each other on',
    codeLabel: 'My invite code',
    kakao: 'KakaoTalk',
    copy: 'Copy link',
    share: 'Share',
  },
};
const MOCK_CAPTURES = new Set([
  '50_내_초대',
  '51_발자국_판',
  '85_초대카드_로그인',
  '86_초대_환영_시트',
]);

const pad = (number) => String(number).padStart(2, '0');

export function capturePath(root, device, capture, locale) {
  return join(
    root,
    device,
    capture.plan,
    capture.theme,
    ...(locale === 'en' ? ['en'] : []),
    `${capture.file}.png`,
  );
}

// 렌더 작업 목록. 같은 입력이면 같은 순서·같은 파일 이름이다.
export function plan({ only, locales }) {
  const jobs = [];
  // only: 쉼표로 여러 개. 각 값은 scenes·screenshots·세트 id·대상 id·장면 id 또는 '세트/대상'(예: cpp-ai/iphone-6.3)
  const filters = only == null ? null : only.split(',');
  const wanted = (...keys) => filters == null || filters.some((filter) => keys.includes(filter));
  for (const set of SETS) {
    for (const targetId of set.targets) {
      const target = TARGETS[targetId];
      for (const locale of (set.locales ?? LOCALES).filter((item) => locales.includes(item))) {
        if (!wanted('screenshots', set.id, targetId, `${set.id}/${targetId}`)) {
          continue;
        }
        const storeLocale = STORE_LOCALE[target.store][locale];
        set.slots.forEach((slotId, index) => {
          jobs.push({
            type: 'screenshot',
            set,
            target,
            targetId,
            locale,
            slotId,
            index,
            slot: SLOTS[slotId],
            output: join(
              target.store,
              storeLocale,
              set.id,
              target.folder,
              `${pad(index + 1)}_${slotId}.png`,
            ),
          });
        });
      }
    }
  }
  for (const [sceneId, scene] of Object.entries(SCENES)) {
    if (!wanted('scenes', sceneId)) {
      continue;
    }
    const sceneLocales =
      scene.text === false ? [null] : LOCALES.filter((item) => locales.includes(item));
    for (const locale of sceneLocales) {
      const folder = locale == null ? 'shared' : STORE_LOCALE[scene.store][locale];
      jobs.push({
        type: 'scene',
        sceneId,
        scene,
        locale,
        output: join(scene.store, folder, 'graphics', scene.file),
      });
    }
  }
  return jobs;
}

// 대상 기기 폴더는 하나 또는 우선순위 목록이다. 목록이면 캡처가 있는 첫 폴더를 쓴다.
export function resolveDevice(root, devices, capture, locale) {
  const list = Array.isArray(devices) ? devices : [devices];
  return list.find((device) => existsSync(capturePath(root, device, capture, locale))) ?? list[0];
}

// 장면 하나가 쓰는 캡처: [기기 폴더(또는 목록), 캡처, 역할]. 역할 folded=Duo 접힘, pair=Play 태블릿 두 번째 화면.
export function captureNeeds(job) {
  const { target, slot } = job;
  const needs = [[target.device, slot.capture, 'main']];
  if ((target.layout ?? slot.layout) === 'duo-pair') {
    needs.push([target.foldedDevice, slot.foldedCapture, 'folded']);
  }
  if (target.layout === 'card-pair') {
    needs.push([target.device, slot.tabletPair ?? slot.capture, 'pair']);
  }
  return needs;
}

function screenSource(job, captureRoot, devices, capture) {
  const device = resolveDevice(captureRoot, devices, capture, job.locale);
  const path = capturePath(captureRoot, device, capture, job.locale);
  return { path: existsSync(path) ? path : null, label: relative(captureRoot, path), device };
}

// stripSystemBars면 기기의 상태 막대·홈 인디케이터(키보드 화면은 키보드 윗선 아래 전부)를 비율로 잘라 내고,
// 카드 비율을 잘라 낸 화면에 맞춘다. bottomPx는 아래에서 잘라 낼 높이(px).
export function systemBarCrop(device, width, height, bottomPx) {
  const bars = CAPTURE_DEVICES[device];
  if (bars == null) {
    throw new Error(`${device}: CAPTURE_DEVICES에 OS 막대 높이가 없어요`);
  }
  const bottom = Math.max(bottomPx ?? 0, bars.homeIndicator);
  return {
    top: bars.statusBar / height,
    bottom: bottom / height,
    aspect: width / (height - bars.statusBar - bottom),
  };
}

// 라이트 테마 iOS 키보드 바탕(#e2e3e8 근처)이 화면 왼쪽 끝에서 화면 높이의 15% 넘게 이어지면 키보드로 보고,
// 그 윗선부터 아래 끝까지의 높이(px)를 돌려준다. 키보드가 없으면 0.
export async function keyboardHeight(path) {
  const { data, info } = await sharp(path)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const x = Math.round(info.width * 0.008);
  const isKeyboard = (y) => {
    const index = (y * info.width + x) * 3;
    return [226, 227, 232].every((value, channel) => Math.abs(data[index + channel] - value) <= 6);
  };
  const run = Math.round(info.height * 0.15);
  for (let top = Math.round(info.height * 0.4); top < info.height - run; top += 1) {
    let length = 0;
    while (length < run && isKeyboard(top + length)) {
      length += 1;
    }
    if (length === run) {
      // 키보드 윗선의 그림자 줄까지 함께 잘라 낸다
      return info.height - top + Math.round(info.height * 0.003);
    }
    top += length;
  }
  return 0;
}

async function screenSpec(source, frameAspect, capture, locale, strip) {
  if (source.path == null) {
    return MOCK_CAPTURES.has(capture.file)
      ? { mock: 'invite', mockCopy: INVITE_MOCK[locale], label: source.label }
      : { label: source.label };
  }
  const { width, height } = await sharp(source.path).metadata();
  const src = pathToFileURL(source.path).href;
  if (strip) {
    const keyboard = KEYBOARD_SCREENS.has(capture.file) ? await keyboardHeight(source.path) : 0;
    const crop = systemBarCrop(source.device, width, height, keyboard);
    return { src, fit: 'cover', crop, aspect: crop.aspect, label: source.label };
  }
  const fit = Math.abs(width / height - frameAspect) / frameAspect > 0.03 ? 'contain' : 'cover';
  return { src, fit, label: source.label };
}

const FRAME_ASPECT = {
  iphone: 1206 / 2622,
  'duo-open': 2007 / 2853,
  'duo-closed': 1398 / 2034,
  ipad: 2064 / 2752,
  card: 1080 / 2400,
};

async function buildScreenshotJob(job, captureRoot, preview) {
  const { target, slot, locale } = job;
  const copy = slotCopy(slot, target.store, locale);
  const layout = target.layout ?? slot.layout ?? 'single';
  const strip = target.stripSystemBars === true;
  const sources = [];
  const spec = {
    width: target.width,
    height: target.height,
    store: target.store,
    frame: target.frame,
    layout,
    tagline: copy.tagline,
    headline: copy.headline,
    note: copy.note ?? null,
    badge: target.badge && slot.isNew ? 'NEW' : null,
    decor: slot.decor ?? null,
    catSrc: ASSETS.cat,
    motif: job.index ?? 0,
    preview: preview ? `PREVIEW · ${RELEASE_VERSION}` : null,
    bare: target.bare === true,
  };
  for (const [devices, capture, role] of captureNeeds(job)) {
    const source = screenSource(job, captureRoot, devices, capture);
    sources.push(source);
    const frame =
      role === 'folded' ? 'duo-closed' : layout === 'duo-pair' ? 'duo-open' : target.frame;
    const screen = await screenSpec(source, FRAME_ASPECT[frame], capture, locale, strip);
    spec[role === 'main' ? 'screen' : role] = screen;
  }
  return { spec, sources };
}

function glyphProblems(text) {
  const juaFile = join(HERE, 'fonts/jua-subset.txt');
  const handFile = join(HERE, 'fonts/hand-subset.txt');
  const available = new Set([...readFileSync(juaFile, 'utf8'), ...readFileSync(handFile, 'utf8')]);
  const missing = [...new Set(text.replace(/\s/gu, ''))].filter((char) => !available.has(char));
  return missing.length > 0
    ? [
        `서브셋에 없는 글자 ${missing.join('')} — node store-metadata/art/fonts/subset.mjs를 다시 실행하세요`,
      ]
    : [];
}

async function finish(png, job, expected) {
  // 알파 없는 sRGB PNG(App Store·Play 공통 조건)
  const output = await sharp(png)
    .flatten({ background: '#ffffff' })
    .removeAlpha()
    .toColourspace('srgb')
    // Play는 JPG 또는 24-bit PNG만 받는다. 1MB 한도가 있는 그래픽은 JPG로 둔다.
    [job.output.endsWith('.jpg') ? 'jpeg' : 'png'](
      job.output.endsWith('.jpg') ? { quality: 90, mozjpeg: true } : { compressionLevel: 9 },
    )
    .toBuffer();
  const meta = await sharp(output).metadata();
  const problems = [];
  if (meta.width !== expected.width || meta.height !== expected.height) {
    problems.push(`크기 ${meta.width}×${meta.height} ≠ ${expected.width}×${expected.height}`);
  }
  if (meta.hasAlpha || meta.channels !== 3) {
    problems.push('알파 채널이 남아 있다');
  }
  const limit =
    job.type === 'scene' && job.scene.maxBytes != null
      ? job.scene.maxBytes
      : job.type === 'scene' && job.scene.design[0] === 1024
        ? MAX_BYTES.feature
        : MAX_BYTES[job.type];
  if (output.length > limit) {
    problems.push(`${Math.round(output.length / 1024)}KiB > ${Math.round(limit / 1024)}KiB`);
  }
  return { output, problems, bytes: output.length };
}

function galleryHtml(entries, { preview, captureRoot }) {
  const groups = new Map();
  for (const entry of entries) {
    const key = entry.group;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(entry);
  }
  const escape = (value) =>
    String(value).replace(
      /[&<>"]/gu,
      (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char],
    );
  const sections = [...groups.entries()]
    .map(([group, items]) => {
      const cards = items
        .map(
          (item) => `<figure>
  <a href="${escape(item.output)}"><img loading="lazy" src="${escape(item.thumb)}" alt="${escape(item.caption)}"></a>
  <figcaption><b>${escape(item.title)}</b><span>${escape(item.caption)}</span><small>${escape(item.size)} · ${escape(item.source)}</small></figcaption>
</figure>`,
        )
        .join('\n');
      return `<section><h2>${escape(group)}</h2><div class="grid">${cards}</div></section>`;
    })
    .join('\n');
  const storyboard = SETS.map((set) => {
    const rows = set.slots
      .map((slotId, index) => {
        const slot = SLOTS[slotId];
        const target = TARGETS[set.targets[0]];
        const ko = slotCopy(slot, target.store, 'ko');
        const en = slotCopy(slot, target.store, 'en');
        const captures = captureNeeds({ target, slot })
          .map(([, capture]) => capture.file)
          .join(' + ');
        return `<tr><td>${pad(index + 1)}</td><td>${escape(slot.title)}</td><td>${escape(ko.tagline)}<br><b>${escape(ko.headline.replace(/[[\]]/gu, ''))}</b></td><td>${escape(en.tagline)}<br><b>${escape(en.headline.replace(/[[\]]/gu, ''))}</b></td><td><code>${escape(captures)}</code></td></tr>`;
      })
      .join('');
    const sizes = set.targets
      .map((id) => `${TARGETS[id].label} ${TARGETS[id].width}×${TARGETS[id].height}`)
      .join(' · ');
    return `<details><summary><b>${escape(set.label)}</b> (${escape(set.id)}) — ${escape(sizes)} · ${escape((set.locales ?? LOCALES).join('/'))}</summary>
<table><thead><tr><th>#</th><th>장면</th><th>한국어</th><th>English</th><th>캡처</th></tr></thead><tbody>${rows}</tbody></table></details>`;
  }).join('\n');
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>아이두 ${RELEASE_VERSION} 스토어 아트</title>
<style>
:root { --bg: #fffaf5; --ink: #222; --muted: #6b6b6b; --line: #eadfd4; --accent: #c2410c; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #1b1714; --ink: #f2ece6; --muted: #b3a89e; --line: #3a322b; --accent: #ff8a65; } }
body { margin: 0; padding: 24px 16px 64px; background: var(--bg); color: var(--ink); font: 15px/1.5 -apple-system, "Apple SD Gothic Neo", sans-serif; }
header { max-width: 1400px; margin: 0 auto 24px; }
h1 { font-size: 24px; margin: 0 0 6px; } h2 { font-size: 18px; margin: 32px 0 12px; border-bottom: 1px solid var(--line); padding-bottom: 6px; }
p { margin: 4px 0; color: var(--muted); }
section { max-width: 1400px; margin: 0 auto; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 16px; }
figure { margin: 0; } img { width: 100%; height: auto; border-radius: 10px; border: 1px solid var(--line); background: #fff; }
figcaption { display: flex; flex-direction: column; gap: 2px; margin-top: 6px; font-size: 13px; }
figcaption b { color: var(--accent); } figcaption small { color: var(--muted); word-break: break-all; }
details { margin: 8px 0; } summary { cursor: pointer; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 16px; font-size: 13px; display: block; overflow-x: auto; }
th, td { border-bottom: 1px solid var(--line); padding: 6px 8px; text-align: left; vertical-align: top; }
code { font-size: 12px; }
</style></head><body>
<header><h1>아이두 ${RELEASE_VERSION} 스토어 아트 ${preview ? '미리보기' : '최종본'}</h1>
<p>생성: apps/mobile/store-metadata/art/render.mjs · 캡처 루트: ${escape(captureRoot)}</p>
${preview ? '<p>PREVIEW 표시가 있는 장은 실제 1.13.0 캡처가 아니라 자리표시·이전 화면이에요. 캡처 후 같은 명령에서 --preview를 빼면 최종본이 나와요.</p>' : ''}
</header>
<section><h2>스토리보드</h2>${storyboard}</section>
${sections}
</body></html>
`;
}

async function render({ out, captureRoot, preview, only, locales }) {
  const jobs = plan({ only, locales });
  const errors = [];
  if (!preview) {
    const missing = [];
    for (const job of jobs.filter((item) => item.type === 'screenshot')) {
      const built = await buildScreenshotJob(job, captureRoot, false);
      missing.push(
        ...built.sources.filter((source) => source.path == null).map((source) => source.label),
      );
    }
    if (missing.length > 0) {
      const unique = [...new Set(missing)].sort();
      throw new Error(
        `최종본에 필요한 캡처가 ${unique.length}개 없어요(--preview로 미리보기만 만들 수 있어요):\n${unique.map((item) => `  - ${item}`).join('\n')}`,
      );
    }
  }
  const chrome = await launchChrome();
  const entries = [];
  try {
    for (const job of jobs) {
      let result;
      let expected;
      let source = '';
      let title;
      let caption;
      if (job.type === 'screenshot') {
        const built = await buildScreenshotJob(job, captureRoot, preview);
        expected = { width: job.target.width, height: job.target.height };
        result = await chrome.render({
          url: pathToFileURL(join(HERE, 'templates/screenshot.html')).href,
          width: expected.width,
          height: expected.height,
          job: built.spec,
        });
        source = built.sources
          .map((item) => (item.path == null ? `캡처 대기: ${item.label}` : item.label))
          .join(' + ');
        title = `${job.slotId} · ${job.slot.title}`;
        const copy = slotCopy(job.slot, job.target.store, job.locale);
        caption = `${copy.tagline} / ${copy.headline.replace(/[[\]]/gu, '').replace('\n', ' ')}`;
      } else {
        const [width, height] = job.scene.design;
        expected = { width: width * job.scene.scale, height: height * job.scene.scale };
        const copy = job.locale == null ? {} : job.scene[job.locale];
        result = await chrome.render({
          url: pathToFileURL(join(HERE, 'templates/scene.html')).href,
          width,
          height,
          scale: job.scene.scale,
          job: {
            scene: job.sceneId,
            design: job.scene.design,
            copy,
            card: CARD_COPY[job.locale ?? 'ko'],
            assets: ASSETS,
            name: job.locale === 'en' ? 'Aido' : '아이두',
          },
        });
        errors.push(
          ...glyphProblems(result.report.text).map((problem) => `${job.output}: ${problem}`),
        );
        title = `${job.sceneId} · ${job.scene.label}`;
        caption =
          job.locale == null
            ? '글자 없음(공용)'
            : `${copy.tagline} / ${copy.headline.replace(/[[\]]/gu, '').replace('\n', ' ')}`;
        source = '캡처 불필요';
      }
      const { report } = result;
      for (const failure of contrastFailures(report.contrast)) {
        errors.push(
          `${job.output}: 대비 ${failure.ratio.toFixed(2)}:1 < 기준 (${failure.name} ${failure.color} on ${failure.background})`,
        );
      }
      if (report.broken.length > 0) {
        errors.push(`${job.output}: 이미지를 불러오지 못했어요 ${report.broken.join(', ')}`);
      }
      if (report.fonts.length > 0) {
        errors.push(`${job.output}: 글꼴을 불러오지 못했어요 ${report.fonts.join(', ')}`);
      }
      if (report.cardOverflow?.length > 0) {
        errors.push(`${job.output}: 카드 밖으로 넘친 요소 ${report.cardOverflow.join(', ')}`);
      }
      if (report.overflow) {
        errors.push(`${job.output}: 문구가 화면 밖으로 넘쳐요`);
      }
      const finished = await finish(result.png, job, expected);
      errors.push(...finished.problems.map((problem) => `${job.output}: ${problem}`));
      const path = join(out, job.output);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, finished.output);
      const thumb = join('thumbs', job.output.replace(/\.(png|jpg)$/u, '.jpg'));
      mkdirSync(dirname(join(out, thumb)), { recursive: true });
      await sharp(finished.output)
        .resize({ width: 360 })
        .jpeg({ quality: 72, mozjpeg: true })
        .toFile(join(out, thumb));
      const minContrast = Math.min(
        ...report.contrast.map((item) => contrastRatio(item.color, item.background)),
      );
      entries.push({
        group:
          job.type === 'screenshot'
            ? `${job.set.label} · ${job.target.label} · ${job.locale}`
            : `그래픽 · ${job.scene.label}`,
        output: job.output,
        thumb,
        title,
        caption,
        size: `${expected.width}×${expected.height}`,
        source,
        minContrast: Number.isFinite(minContrast) ? Number(minContrast.toFixed(2)) : null,
        bytes: finished.bytes,
      });
      process.stdout.write(`${job.output}\n`);
    }
  } finally {
    await chrome.close();
  }
  writeFileSync(
    join(out, 'manifest.json'),
    `${JSON.stringify({ release: RELEASE_VERSION, preview, captureRoot, entries }, null, 2)}\n`,
  );
  writeFileSync(join(out, 'index.html'), galleryHtml(entries, { preview, captureRoot }));
  if (errors.length > 0) {
    throw new Error(
      `검사 실패 ${errors.length}건:\n${errors.map((error) => `  - ${error}`).join('\n')}`,
    );
  }
  console.log(`${entries.length}장 → ${out} (갤러리 index.html)`);
}

function listCaptures({ captureRoot, locales }) {
  const rows = new Map();
  for (const job of plan({ only: 'screenshots', locales })) {
    for (const [devices, capture] of captureNeeds(job)) {
      const device = resolveDevice(captureRoot, devices, capture, job.locale);
      const path = capturePath(captureRoot, device, capture, job.locale);
      const key = relative(captureRoot, path);
      const row = rows.get(key) ?? {
        path: key,
        exists: existsSync(path),
        manual: capture.manual === true,
        usedBy: new Set(),
      };
      row.usedBy.add(`${job.set.id}/${job.targetId}/${job.slotId}`);
      rows.set(key, row);
    }
  }
  const sorted = [...rows.values()].sort((a, b) => a.path.localeCompare(b.path));
  for (const row of sorted) {
    console.log(
      `${row.exists ? '있음' : '없음'}${row.manual ? '(직접)' : ''}\t${row.path}\t← ${[...row.usedBy].join(', ')}`,
    );
  }
  const missing = sorted.filter((row) => !row.exists).length;
  console.log(`\n필요 ${sorted.length}개 · 없음 ${missing}개 · 캡처 루트 ${captureRoot}`);
  return sorted;
}

// 캡처 전 업로드 폴더: 스크린샷 폴더마다 어떤 캡처로 어떤 장을 만들지 TODO.md를 둔다.
function writeTodos({ out, captureRoot, locales }) {
  const folders = new Map();
  for (const job of plan({ only: 'screenshots', locales })) {
    const folder = dirname(join(out, job.output));
    const lines = folders.get(folder) ?? [];
    const needed = captureNeeds(job).map(([devices, capture]) => {
      const device = resolveDevice(captureRoot, devices, capture, job.locale);
      const path = capturePath(captureRoot, device, capture, job.locale);
      return `\`${relative(captureRoot, path)}\`${existsSync(path) ? '' : ' (없음)'}${capture.manual ? ' (직접 찍기)' : ''}`;
    });
    lines.push(
      `- [ ] ${job.output.split('/').pop()} — ${slotCopy(job.slot, job.target.store, job.locale).headline.replace(/[[\]]/gu, '').replace('\n', ' ')} ← ${needed.join(' + ')}`,
    );
    folders.set(folder, lines);
  }
  for (const [folder, lines] of folders) {
    mkdirSync(folder, { recursive: true });
    writeFileSync(
      join(folder, 'TODO.md'),
      `# 캡처 후 만들 스크린샷\n\n실제 ${RELEASE_VERSION} 캡처가 아직 없어 비워 둔 폴더예요. 캡처를 마친 뒤\n\`pnpm --filter @aido/mobile store:art --out <업로드 폴더>\`를 실행하면 이 목록의 파일이 생겨요.\n캡처 루트: ${captureRoot}\n\n${lines.join('\n')}\n`,
    );
  }
  console.log(`TODO.md ${folders.size}개 → ${out}`);
}

// App Store 에셋 라이브러리 이름: 1.13.0_<세트 또는 자리>_<언어>_<대상>_<번호>
export function assetNames({ locales }) {
  return plan({ only: undefined, locales })
    .filter((job) => job.output.startsWith('app-store/'))
    .map((job) => {
      if (job.type === 'screenshot') {
        const number = job.output.split('/').pop().slice(0, 2);
        return {
          output: job.output,
          name: `${RELEASE_VERSION}_${job.set.id}_${job.locale}_${job.targetId}_${number}`,
        };
      }
      return {
        output: job.output,
        name: `${RELEASE_VERSION}_${job.sceneId}_${job.locale ?? 'shared'}`,
      };
    });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { positionals, values } = parseArgs({
    args: process.argv.slice(2).filter((arg) => arg !== '--'),
    allowPositionals: true,
    options: {
      out: { type: 'string' },
      captures: { type: 'string', default: defaultCaptureRoot },
      preview: { type: 'boolean', default: false },
      only: { type: 'string' },
      locales: { type: 'string', default: LOCALES.join(',') },
    },
  });
  const options = {
    captureRoot: resolve(values.captures),
    preview: values.preview,
    only: values.only,
    locales: values.locales.split(','),
  };
  try {
    if (positionals[0] === 'captures') {
      listCaptures(options);
    } else if (positionals[0] === 'asset-names') {
      const rows = assetNames(options).map((row) => `| \`${row.output}\` | \`${row.name}\` |`);
      const markdown = `# App Store 에셋 라이브러리 이름 (${RELEASE_VERSION})\n\n업로드한 뒤 에셋 라이브러리에서 이 이름으로 바꾸면 CPP·PPO·이벤트에서 찾기 쉬워요.\n규칙: \`${RELEASE_VERSION}_<세트 또는 자리>_<언어>_<대상>_<번호>\`\n\n| 업로드 파일 | 에셋 이름 |\n| --- | --- |\n${rows.join('\n')}\n`;
      if (values.out == null) {
        console.log(markdown);
      } else {
        writeFileSync(resolve(values.out), markdown);
        console.log(`${rows.length}개 → ${resolve(values.out)}`);
      }
    } else if (positionals[0] === 'todo') {
      if (values.out == null) {
        throw new Error('--out <폴더>가 필요해요');
      }
      writeTodos({ ...options, out: resolve(values.out) });
    } else {
      if (values.out == null) {
        throw new Error('--out <폴더>가 필요해요');
      }
      await render({ ...options, out: resolve(values.out) });
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
