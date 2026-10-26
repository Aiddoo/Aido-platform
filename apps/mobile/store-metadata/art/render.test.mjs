import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import sharp from 'sharp';

import { contrastFailures, contrastRatio } from './lib/contrast.mjs';
import { captureNeeds, keyboardHeight, plan, systemBarCrop } from './render.mjs';
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
  const plain = systemBarCrop('iPhone 17 Pro', 1206, 2622, 0);
  assert.equal(plain.top, 186 / 2622);
  assert.equal(plain.bottom, 102 / 2622);
  assert.equal(plain.aspect, 1206 / (2622 - 186 - 102));
  const keyboard = systemBarCrop('iPhone 17 Pro', 1206, 2622, 950);
  assert.equal(keyboard.bottom, 950 / 2622);
  assert.throws(() => systemBarCrop('Android 폰', 1080, 2400, 0));
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
