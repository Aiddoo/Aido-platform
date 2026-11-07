import { createConsent } from '@src/features/identity/consent/__tests__/consent.fixtures';
import { toInstant } from '@src/shared/date/instant';
import dayjs from 'dayjs';

import { type MarketingPushPromptState } from '../schemas/marketing-push-prompt.schema';
import { MarketingPushPromptPolicy } from './marketing-push-prompt.model';

const promptState = (overrides?: Partial<MarketingPushPromptState>): MarketingPushPromptState => ({
  lastPromptedAt: null,
  count: 0,
  ...overrides,
});

const NOW = toInstant('2026-07-20T09:00:00.000Z');

describe('MarketingPushPromptPolicy.shouldPrompt', () => {
  const notAgreed = createConsent({ marketingPushAgreedAt: null });

  it('닫기 횟수가 상한(3)보다 적으면 노출한다', () => {
    expect(MarketingPushPromptPolicy.shouldPrompt(notAgreed, promptState({ count: 2 }), NOW)).toBe(
      true,
    );
  });

  it('마지막 닫기로부터 정확히 쿨다운(14일)이 지나면 노출한다', () => {
    const state = promptState({
      lastPromptedAt: toInstant(dayjs(NOW).subtract(14, 'day').toISOString()),
    });
    expect(MarketingPushPromptPolicy.shouldPrompt(notAgreed, state, NOW)).toBe(true);
  });

  it('쿨다운이 1ms 모자라면 노출하지 않는다', () => {
    const state = promptState({
      lastPromptedAt: toInstant(dayjs(NOW).subtract(14, 'day').add(1, 'millisecond').toISOString()),
    });
    expect(MarketingPushPromptPolicy.shouldPrompt(notAgreed, state, NOW)).toBe(false);
  });

  it('동의 정보 로딩 전(undefined)이면 노출하지 않는다', () => {
    expect(MarketingPushPromptPolicy.shouldPrompt(undefined, promptState(), NOW)).toBe(false);
  });

  it('이미 동의한 유저에게는 노출하지 않는다', () => {
    const consent = createConsent({
      marketingPushAgreedAt: toInstant(dayjs(NOW).subtract(1, 'day').toISOString()),
    });
    expect(MarketingPushPromptPolicy.shouldPrompt(consent, promptState(), NOW)).toBe(false);
  });

  it('닫기 상한에 도달하면 노출하지 않는다', () => {
    const consent = createConsent({ marketingPushAgreedAt: null });
    expect(MarketingPushPromptPolicy.shouldPrompt(consent, promptState({ count: 3 }), NOW)).toBe(
      false,
    );
  });

  it('쿨다운 이내면 노출하지 않는다', () => {
    const consent = createConsent({ marketingPushAgreedAt: null });
    const state = promptState({
      lastPromptedAt: toInstant(dayjs(NOW).subtract(5, 'day').toISOString()),
      count: 1,
    });
    expect(MarketingPushPromptPolicy.shouldPrompt(consent, state, NOW)).toBe(false);
  });

  it('미동의 + 상한 미만 + 쿨다운 경과면 노출한다', () => {
    const consent = createConsent({ marketingPushAgreedAt: null });
    const state = promptState({
      lastPromptedAt: toInstant(dayjs(NOW).subtract(20, 'day').toISOString()),
      count: 1,
    });
    expect(MarketingPushPromptPolicy.shouldPrompt(consent, state, NOW)).toBe(true);
  });

  it('미동의 + 첫 노출이면 노출한다', () => {
    const consent = createConsent({ marketingPushAgreedAt: null });
    expect(MarketingPushPromptPolicy.shouldPrompt(consent, promptState(), NOW)).toBe(true);
  });
});
