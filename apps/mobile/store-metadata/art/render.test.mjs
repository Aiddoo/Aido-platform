import assert from 'node:assert/strict';
import { test } from 'node:test';

import { contrastFailures, contrastRatio } from './lib/contrast.mjs';
import { plan } from './render.mjs';
import { LOCALES, SCENES, SETS, SLOTS, TARGETS } from './storyboard.mjs';

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
