import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { DAY_MS } from '@src/shared/constants/time-units';
import { toEpochMs, toInstant } from '@src/shared/date/instant';

import { MarketingPushPromptPolicy } from './marketing-push-prompt.model';

const NOW = toInstant('2026-11-09T09:00:00.000Z');

function daysBeforeNow(days: number, extraMs = 0) {
  return toInstant(new Date(toEpochMs(NOW) - days * DAY_MS + extraMs).toISOString());
}

describe('shouldPrompt', () => {
  const notAgreed = createConsent({ marketingPushAgreedAt: null });

  it.each([
    ['닫은 적 없으면 제안한다', notAgreed, null, true],
    ['거절한 지 90일이 되기 직전까지 제안하지 않는다', notAgreed, daysBeforeNow(90, 1), false],
    ['거절한 지 90일째부터 다시 제안한다', notAgreed, daysBeforeNow(90), true],
    ['이미 동의했으면 제안하지 않는다', createConsent({ marketingPushAgreedAt: NOW }), null, false],
  ] as const)('%s', (_label, consent, dismissedAt, expected) => {
    // When
    const result = MarketingPushPromptPolicy.shouldPrompt(consent, { dismissedAt }, NOW);

    // Then
    expect(result).toBe(expected);
  });
});
