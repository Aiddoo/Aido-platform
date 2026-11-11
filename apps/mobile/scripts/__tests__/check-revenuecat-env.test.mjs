import assert from 'node:assert/strict';
import { test } from 'node:test';

import { inspectRevenueCatExtra, maskKey } from '../check-revenuecat-env.mjs';

const APPLE = 'appl_abcdefghijklmnopqrstuvwxyz';
const GOOGLE = 'goog_abcdefghijklmnopqrstuvwxyz';
const TEST = 'test_abcdefghijklmnopqrstuvwxyz';

test('키 값은 접두사와 길이만 남긴다', () => {
  // When
  const masked = maskKey(APPLE);

  // Then
  assert.equal(masked, 'appl_… (31자)');
  assert.ok(!masked.includes('abcdef'));
});

test('개발 번들은 세 키가 모두 맞는 접두사로 있으면 통과한다', () => {
  // Given
  const extra = {
    revenueCatAppleApiKey: APPLE,
    revenueCatGoogleApiKey: GOOGLE,
    revenueCatTestApiKey: TEST,
  };

  // When
  const { problems } = inspectRevenueCatExtra(extra, 'development');

  // Then
  assert.deepEqual(problems, []);
});

test('운영 번들에 테스트 키가 있으면 실패한다', () => {
  // Given
  const extra = {
    revenueCatAppleApiKey: APPLE,
    revenueCatGoogleApiKey: GOOGLE,
    revenueCatTestApiKey: TEST,
  };

  // When
  const { problems } = inspectRevenueCatExtra(extra, 'production');

  // Then
  assert.match(problems.join(), /production 번들에 REVENUECAT_TEST_API_KEY/u);
});

test('키가 비었거나 다른 플랫폼 키가 들어가면 실패한다', () => {
  // Given
  const extra = { revenueCatAppleApiKey: GOOGLE };

  // When
  const { problems } = inspectRevenueCatExtra(extra, 'preview');

  // Then
  assert.match(problems.join(), /REVENUECAT_APPLE_API_KEY는 appl_로 시작/u);
  assert.match(problems.join(), /REVENUECAT_GOOGLE_API_KEY가 비어/u);
});
