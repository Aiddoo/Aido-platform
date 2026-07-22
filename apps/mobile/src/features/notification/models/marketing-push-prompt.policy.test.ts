import { createConsent } from '@src/features/auth/__tests__/auth.factories';
import type { MarketingPushPromptState } from '@src/shared/preferences/marketing-push-prompt.preference';
import dayjs from 'dayjs';
import {
  hasCooldownElapsed,
  isNotAgreedToMarketingPush,
  isUnderPromptLimit,
  MarketingPushPromptPolicy,
} from './marketing-push-prompt.policy';

const promptState = (overrides?: Partial<MarketingPushPromptState>): MarketingPushPromptState => ({
  lastPromptedAt: null,
  count: 0,
  ...overrides,
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-20T09:00:00.000Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('isNotAgreedToMarketingPush', () => {
  it('광고성 푸시 미동의(null)면 true를 반환한다', () => {
    // Given
    const consent = createConsent({ marketingPushAgreedAt: null });

    // When / Then
    expect(isNotAgreedToMarketingPush(consent)).toBe(true);
  });

  it('이미 동의한 상태면 false를 반환한다', () => {
    // Given
    const consent = createConsent({ marketingPushAgreedAt: dayjs().subtract(1, 'day').toDate() });

    // When / Then
    expect(isNotAgreedToMarketingPush(consent)).toBe(false);
  });
});

describe('isUnderPromptLimit', () => {
  it('닫기 횟수가 상한 미만이면 true를 반환한다', () => {
    expect(isUnderPromptLimit(promptState({ count: 2 }))).toBe(true);
  });

  it('닫기 횟수가 상한(3)과 같으면 false를 반환한다', () => {
    expect(isUnderPromptLimit(promptState({ count: 3 }))).toBe(false);
  });

  it('닫기 횟수가 상한을 초과하면 false를 반환한다', () => {
    expect(isUnderPromptLimit(promptState({ count: 4 }))).toBe(false);
  });
});

describe('hasCooldownElapsed', () => {
  it('한 번도 닫은 적 없으면(null) true를 반환한다', () => {
    expect(hasCooldownElapsed(promptState({ lastPromptedAt: null }))).toBe(true);
  });

  it('마지막 닫기로부터 정확히 쿨다운(14일)이 지나면 true를 반환한다', () => {
    const state = promptState({ lastPromptedAt: dayjs().subtract(14, 'day').toISOString() });
    expect(hasCooldownElapsed(state)).toBe(true);
  });

  it('쿨다운이 1ms 모자라면 false를 반환한다', () => {
    const state = promptState({
      lastPromptedAt: dayjs().subtract(14, 'day').add(1, 'millisecond').toISOString(),
    });
    expect(hasCooldownElapsed(state)).toBe(false);
  });

  it('쿨다운을 훨씬 넘겼으면 true를 반환한다', () => {
    const state = promptState({ lastPromptedAt: dayjs().subtract(20, 'day').toISOString() });
    expect(hasCooldownElapsed(state)).toBe(true);
  });
});

describe('MarketingPushPromptPolicy.shouldPrompt', () => {
  it('동의 정보 로딩 전(undefined)이면 노출하지 않는다', () => {
    expect(MarketingPushPromptPolicy.shouldPrompt(undefined, promptState())).toBe(false);
  });

  it('이미 동의한 유저에게는 노출하지 않는다', () => {
    const consent = createConsent({ marketingPushAgreedAt: dayjs().subtract(1, 'day').toDate() });
    expect(MarketingPushPromptPolicy.shouldPrompt(consent, promptState())).toBe(false);
  });

  it('닫기 상한에 도달하면 노출하지 않는다', () => {
    const consent = createConsent({ marketingPushAgreedAt: null });
    expect(MarketingPushPromptPolicy.shouldPrompt(consent, promptState({ count: 3 }))).toBe(false);
  });

  it('쿨다운 이내면 노출하지 않는다', () => {
    const consent = createConsent({ marketingPushAgreedAt: null });
    const state = promptState({
      lastPromptedAt: dayjs().subtract(5, 'day').toISOString(),
      count: 1,
    });
    expect(MarketingPushPromptPolicy.shouldPrompt(consent, state)).toBe(false);
  });

  it('미동의 + 상한 미만 + 쿨다운 경과면 노출한다', () => {
    const consent = createConsent({ marketingPushAgreedAt: null });
    const state = promptState({
      lastPromptedAt: dayjs().subtract(20, 'day').toISOString(),
      count: 1,
    });
    expect(MarketingPushPromptPolicy.shouldPrompt(consent, state)).toBe(true);
  });

  it('미동의 + 첫 노출이면 노출한다', () => {
    const consent = createConsent({ marketingPushAgreedAt: null });
    expect(MarketingPushPromptPolicy.shouldPrompt(consent, promptState())).toBe(true);
  });
});
