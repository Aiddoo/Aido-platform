import { DAY_MS } from '@src/shared/constants/time-units';
import { toEpochMs, toInstant } from '@src/shared/date/instant';

import type { StoreReviewState } from './store-review.model';
import { createEmptyStoreReviewState, StoreReviewPolicy } from './store-review.model';

/** iOS가 365일에 3번까지 띄우는 몫을 120일 간격으로 나눈다 */
const REQUEST_COOLDOWN_DAYS = 120;
const REQUEST_WINDOW_DAYS = 365;

const NOW = toInstant('2026-10-27T12:00:00.000Z');
const daysBefore = (days: number, msLater = 0) =>
  toInstant(new Date(toEpochMs(NOW) - days * DAY_MS + msLater).toISOString());

const withActiveDays = (...localDates: string[]): StoreReviewState =>
  localDates.reduce(StoreReviewPolicy.withActiveDay, createEmptyStoreReviewState());

const ENGAGED: StoreReviewState = withActiveDays('2026-10-20', '2026-10-24', '2026-10-27');

describe('getEligibility', () => {
  it('하루 한 개씩 세 날 할 일을 끝낸 가벼운 사용자는 셋째 날에 요청 대상이 된다', () => {
    // Given
    const twoDays = withActiveDays('2026-10-25', '2026-10-26');

    // When
    const threeDays = StoreReviewPolicy.withActiveDay(twoDays, '2026-10-27');
    const twoDaysEligibility = StoreReviewPolicy.getEligibility(twoDays, NOW);
    const threeDaysEligibility = StoreReviewPolicy.getEligibility(threeDays, NOW);

    // Then
    expect(twoDaysEligibility).toBe('not_engaged');
    expect(threeDaysEligibility).toBe('eligible');
  });

  it('같은 날 여러 번 끝내도 하루로만 센다', () => {
    // Given
    const sameDay = withActiveDays('2026-10-27', '2026-10-27', '2026-10-27', '2026-10-26');

    // When
    const eligibility = StoreReviewPolicy.getEligibility(sameDay, NOW);

    // Then
    expect(sameDay.activeDays).toEqual(['2026-10-27', '2026-10-26']);
    expect(eligibility).toBe('not_engaged');
  });

  it('마지막 요청 뒤 120일이 지나기 전에는 다시 요청하지 않는다', () => {
    // Given
    const justBefore: StoreReviewState = {
      ...ENGAGED,
      requestedAt: [daysBefore(REQUEST_COOLDOWN_DAYS, 1)],
    };
    const elapsed: StoreReviewState = {
      ...ENGAGED,
      requestedAt: [daysBefore(REQUEST_COOLDOWN_DAYS)],
    };

    // When
    const justBeforeEligibility = StoreReviewPolicy.getEligibility(justBefore, NOW);
    const elapsedEligibility = StoreReviewPolicy.getEligibility(elapsed, NOW);

    // Then
    expect(justBeforeEligibility).toBe('cooling_down');
    expect(elapsedEligibility).toBe('eligible');
  });

  it('최근 365일 안에 세 번 요청했으면 쿨다운이 지나도 요청하지 않는다', () => {
    // Given
    const threeInWindow: StoreReviewState = {
      ...ENGAGED,
      requestedAt: [daysBefore(364), daysBefore(244), daysBefore(124)],
    };
    const oldestLeftWindow: StoreReviewState = {
      ...ENGAGED,
      requestedAt: [daysBefore(REQUEST_WINDOW_DAYS), daysBefore(244), daysBefore(124)],
    };

    // When
    const threeInWindowEligibility = StoreReviewPolicy.getEligibility(threeInWindow, NOW);
    const oldestLeftWindowEligibility = StoreReviewPolicy.getEligibility(oldestLeftWindow, NOW);

    // Then
    expect(threeInWindowEligibility).toBe('window_limit_reached');
    expect(oldestLeftWindowEligibility).toBe('eligible');
  });
});

describe('withRequest', () => {
  it('요청 시각을 쌓고 365일 창 밖의 기록은 지운다', () => {
    // Given
    const state: StoreReviewState = { ...ENGAGED, requestedAt: [daysBefore(400), daysBefore(130)] };

    // When
    const next = StoreReviewPolicy.withRequest(state, NOW);

    // Then
    expect(next.requestedAt).toEqual([daysBefore(130), NOW]);
  });
});

describe('시간대가 다른 저장 값', () => {
  it('오프셋이 달라도 같은 순간이면 쿨다운을 같게 판정한다', () => {
    // Given
    const seoul: StoreReviewState = {
      ...ENGAGED,
      requestedAt: [toInstant('2026-06-29T21:00:00.000+09:00')],
    };
    const utc: StoreReviewState = {
      ...ENGAGED,
      requestedAt: [toInstant('2026-06-29T12:00:00.000Z')],
    };

    // When
    const seoulEligibility = StoreReviewPolicy.getEligibility(seoul, NOW);
    const utcEligibility = StoreReviewPolicy.getEligibility(utc, NOW);

    // Then
    // 서울 표기와 UTC 표기는 같은 순간을 가리킨다
    expect(seoulEligibility).toBe(utcEligibility);
  });
});
