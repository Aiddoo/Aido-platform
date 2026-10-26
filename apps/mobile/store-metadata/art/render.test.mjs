import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import sharp from 'sharp';

import { cardLayout, cardWidthForHeight } from './lib/card.mjs';
import { contrastFailures, contrastRatio } from './lib/contrast.mjs';
import { captureNeeds, cleanSheet, keyboardHeight, plan, systemBarCrop } from './render.mjs';
import { LOCALES, SCENES, SETS, SLOTS, TARGETS, slotCopy } from './storyboard.mjs';

test('WCAG 대비율을 계산하고 기준 미달을 고른다', () => {
  assert.equal(contrastRatio('#000000', '#ffffff').toFixed(1), '21.0');
  assert.equal(contrastRatio('rgb(255, 255, 255)', '#ffffff'), 1);
  const failures = contrastFailures([
    { name: 'tagline', color: '#ff6b43', background: '#f7f7f7', level: 'normal' },
    { name: 'headline', color: '#e8552b', background: '#f7f7f7', level: 'large' },
  ]);
  assert.deepEqual(
    failures.map((item) => item.name),
    ['tagline'],
  );
});

test('세트는 있는 장면과 출력 규격만 쓰고 출력 경로가 겹치지 않는다', () => {
  for (const set of SETS) {
    for (const slotId of set.slots) {
      assert.ok(SLOTS[slotId], `${set.id}: ${slotId}`);
    }
    for (const targetId of set.targets) {
      assert.ok(TARGETS[targetId], `${set.id}: ${targetId}`);
    }
    assert.ok(
      set.slots.length <= (set.targets.includes('play-phone') ? 8 : 10),
      `${set.id}: 장수 한도`,
    );
  }
  const outputs = plan({ only: undefined, locales: LOCALES }).map((job) => job.output);
  assert.equal(new Set(outputs).size, outputs.length);
});

test('장면 문구는 ko/en 모두 두 줄 헤드라인이고 태그라인이 짧다', () => {
  for (const [slotId, slot] of Object.entries(SLOTS)) {
    for (const locale of LOCALES) {
      const copy = slot[locale];
      assert.equal(copy.headline.split('\n').length, 2, `${slotId}.${locale}`);
      assert.ok(
        [...copy.tagline].length <= (locale === 'ko' ? 16 : 30),
        `${slotId}.${locale} 태그라인`,
      );
    }
    assert.ok(
      !/아이두|Aido Pro|\bPro\b/u.test(slot.en.headline + slot.en.tagline),
      `${slotId}.en 브랜드`,
    );
    assert.ok(!/Aido|\bPro\b/u.test(slot.ko.headline + slot.ko.tagline), `${slotId}.ko 브랜드`);
  }
});

test('Play 그래픽에는 기간 한정 배지와 홍보 표현을 쓰지 않는다', () => {
  assert.equal(TARGETS['play-phone'].badge, false);
  for (const scene of Object.values(SCENES).filter((item) => item.store === 'google-play')) {
    for (const locale of LOCALES) {
      const text = `${scene[locale]?.tagline ?? ''}${scene[locale]?.headline ?? ''}`;
      assert.ok(!/\b(best|top|new|free)\b|최고|1위|무료|신규/iu.test(text), text);
    }
  }
});

test('글자 없는 그래픽(인앱 이벤트·Play 맞춤 그래픽)은 공용 한 장만 만든다', () => {
  const jobs = plan({ only: 'scenes', locales: LOCALES });
  for (const id of ['event-card', 'event-detail', 'feature-graphic-invite']) {
    const matching = jobs.filter((job) => job.sceneId === id);
    assert.equal(matching.length, 1, id);
    assert.equal(matching[0].locale, null);
  }
});

test('Play 태블릿은 문구 없이 4장 이상, 16:9 1,080~7,680px로 만든다', () => {
  for (const id of ['play-tablet-7', 'play-tablet-10']) {
    const target = TARGETS[id];
    assert.equal(target.bare, true);
    assert.equal(target.badge, false);
    assert.equal(target.width / target.height, 16 / 9);
    assert.ok(
      Math.min(target.width, target.height) >= 1080 &&
        Math.max(target.width, target.height) <= 7680,
    );
    for (const set of SETS.filter((item) => item.targets.includes(id))) {
      assert.ok(set.slots.length >= 4 && set.slots.length <= 8, set.label);
    }
  }
});

test('Play 이미지는 기기 틀 없이 iOS 막대를 잘라 낸 화면 카드이고, 혜택 문구를 쓰지 않는다', () => {
  for (const [id, target] of Object.entries(TARGETS).filter(
    ([, item]) => item.store === 'google-play',
  )) {
    assert.equal(target.frame, 'card', id);
    assert.equal(target.stripSystemBars, true, id);
  }
  for (const set of SETS.filter((item) => TARGETS[item.targets[0]].store === 'google-play')) {
    for (const slotId of set.slots) {
      for (const locale of LOCALES) {
        const copy = slotCopy(SLOTS[slotId], 'google-play', locale);
        const text = `${copy.tagline}${copy.headline}${copy.note ?? ''}`;
        assert.ok(
          !/프리미엄|premium|\b(best|new|free|top-rated)\b|#1|최고|1위|무료|신규/iu.test(text),
          `${slotId}.${locale}`,
        );
      }
    }
  }
  // iOS 홈 화면 위젯은 Play에 쓰지 않는다
  const playSlots = SETS.filter((item) => TARGETS[item.targets[0]].store === 'google-play').flatMap(
    (item) => item.slots,
  );
  assert.ok(!playSlots.some((slotId) => SLOTS[slotId].capture.manual));
});

test('App Store 화면은 같은 종류 기기의 캡처를 쓴다', () => {
  assert.equal(TARGETS['ipad-13'].device, 'iPad Pro 13');
  assert.deepEqual(TARGETS['iphone-6.9'].device, ['iPhone 6.9 원본', 'iPhone 17 Pro']);
  assert.equal(TARGETS['iphone-duo'].device, 'iPhone Duo 펼침');
  assert.equal(TARGETS['iphone-duo-outer'].device, 'iPhone Duo 접힘');
});

test('slotCopy는 Play 문구가 있을 때만 바꿔 쓴다', () => {
  assert.equal(slotCopy(SLOTS.invite, 'app-store', 'ko'), SLOTS.invite.ko);
  assert.equal(slotCopy(SLOTS.invite, 'google-play', 'en'), SLOTS.invite.play.en);
  assert.equal(slotCopy(SLOTS.ai, 'google-play', 'ko'), SLOTS.ai.ko);
});

test('태블릿 두 장 배치는 장면마다 두 번째 화면을 쓴다', () => {
  for (const job of plan({ only: undefined, locales: LOCALES }).filter(
    (item) => item.type === 'screenshot' && item.target.layout === 'card-pair',
  )) {
    const needs = captureNeeds(job);
    assert.equal(needs.length, 2, job.output);
    assert.ok(job.slot.tabletPair, `${job.slotId}에 tabletPair가 없어요`);
    assert.notEqual(needs[0][1].file, needs[1][1].file, job.output);
  }
});

test('OS 막대 자르기는 아래쪽 키보드가 더 길면 키보드 위까지만 남긴다', () => {
  assert.deepEqual(systemBarCrop('iPhone 17 Pro', 0), { top: 150, bottom: 102 });
  assert.deepEqual(systemBarCrop('iPhone 17 Pro', 950), { top: 150, bottom: 950 });
  assert.throws(() => systemBarCrop('Android 폰', 0));
});

test('화면 카드의 첫·마지막 내용 행은 모서리 곡선 영역과 겹치지 않는다', () => {
  const base = {
    srcWidth: 1206,
    srcHeight: 2622,
    cropTop: 186,
    cropBottom: 102,
    radiusRatio: 0.075,
  };
  for (const [cardWidth, maxHeight, continues] of [
    [842, null, false],
    [842, 1300, false],
    [842, 1300, true],
    [700, 5000, false],
  ]) {
    const layout = cardLayout({ ...base, cardWidth, maxHeight, continues });
    assert.ok(layout.contentTop >= layout.radius, '위 여백 < radius');
    assert.ok(layout.height - layout.contentBottom >= layout.radius, '아래 여백 < radius');
    if (maxHeight != null) {
      assert.ok(layout.height <= maxHeight + 1e-6, '최대 높이 초과');
    }
    // 잘라 낸 상태 막대는 카드 위 여백 위로 올라가 덮인다
    assert.ok(Math.abs(layout.imageTop + base.cropTop * layout.scale - layout.contentTop) < 1e-6);
    // 내용이 잘리거나 이어지면 페이드, 다 보이면 페이드 없음
    assert.equal(layout.fade > 0, continues || layout.visible < 2622 - 186 - 102);
  }
  const width = cardWidthForHeight({ ...base, height: 1000 });
  assert.ok(Math.abs(cardLayout({ ...base, cardWidth: width }).height - 1000) < 1e-6);
});

test('키보드 윗선을 찾는다', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'store-art-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'keyboard.png');
  const keyboard = await sharp({
    create: { width: 100, height: 400, channels: 3, background: '#e2e3e8' },
  })
    .png()
    .toBuffer();
  await sharp({ create: { width: 100, height: 1000, channels: 3, background: '#ffffff' } })
    .composite([{ input: keyboard, left: 0, top: 600 }])
    .png()
    .toFile(path);
  assert.equal(await keyboardHeight(path), 403);
  const blank = join(dir, 'blank.png');
  await sharp({ create: { width: 100, height: 1000, channels: 3, background: '#ffffff' } })
    .png()
    .toFile(blank);
  assert.equal(await keyboardHeight(blank), 0);
});

test('--only는 쉼표로 여러 값과 세트/대상 조합을 받는다', () => {
  const jobs = plan({ only: 'cpp-ai/iphone-6.3,header', locales: ['ko'] });
  assert.ok(jobs.length > 0);
  for (const job of jobs) {
    if (job.type === 'screenshot') {
      assert.equal(job.set.id, 'cpp-ai');
      assert.equal(job.targetId, 'iphone-6.3');
    } else {
      assert.equal(job.sceneId, 'header');
    }
  }
  assert.equal(jobs.filter((job) => job.type === 'scene').length, 1);
});

test('iOS 시트 화면은 어두운 배경을 시트 바탕색으로 지우고 시트 안쪽은 그대로 둔다', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'store-art-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  // 100~160행: 양끝 40px만 어두운 배경(시트 모서리 바깥), 가운데는 시트(흰색)와 그 안의 회색 버튼
  const corner = await sharp({
    create: { width: 40, height: 60, channels: 3, background: '#555555' },
  })
    .png()
    .toBuffer();
  const button = await sharp({
    create: { width: 60, height: 60, channels: 3, background: '#cccccc' },
  })
    .png()
    .toBuffer();
  const sheet = join(dir, 'sheet.png');
  await sharp({ create: { width: 1000, height: 1000, channels: 3, background: '#ffffff' } })
    .composite([
      { input: corner, left: 0, top: 100 },
      { input: corner, left: 960, top: 100 },
      { input: button, left: 60, top: 110 },
    ])
    .png()
    .toFile(sheet);
  const cleaned = await cleanSheet(sheet, 98);
  assert.equal(cleaned.top, 98);
  const { data, info } = await sharp(cleaned.path).raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => data[(y * info.width + x) * info.channels];
  assert.equal(at(5, 120), 255, '왼쪽 모서리 바깥');
  assert.equal(at(995, 120), 255, '오른쪽 모서리 바깥');
  assert.equal(at(80, 130), 0xcc, '시트 안 버튼은 그대로');
  const plain = join(dir, 'plain.png');
  await sharp({ create: { width: 1000, height: 1000, channels: 3, background: '#ffffff' } })
    .png()
    .toFile(plain);
  assert.equal(await cleanSheet(plain, 100), null);
});
