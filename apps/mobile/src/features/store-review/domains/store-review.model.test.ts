import {
  createEmptyStoreReviewState,
  STORE_REVIEW_MAX_REQUESTS_PER_WINDOW,
  STORE_REVIEW_MIN_ACTIVE_DAYS,
  STORE_REVIEW_REQUEST_COOLDOWN_DAYS,
  STORE_REVIEW_REQUEST_WINDOW_DAYS,
  StoreReviewPolicy,
  type StoreReviewState,
  StoreReviewTransitions,
} from './store-review.model';

const DAY_MS = 86_400_000;
const NOW = new Date('2026-10-27T12:00:00.000Z');
const daysBefore = (days: number) => new Date(NOW.getTime() - days * DAY_MS);

const withActiveDays = (...localDates: string[]): StoreReviewState =>
  localDates.reduce(StoreReviewTransitions.recordActiveDay, createEmptyStoreReviewState());

const ENGAGED: StoreReviewState = withActiveDays('2026-10-20', '2026-10-24', '2026-10-27');

describe('StoreReviewPolicy.evaluate', () => {
  it('하루 한 개씩 세 날 할 일을 끝낸 가벼운 사용자는 셋째 날에 요청 대상이 된다', () => {
    // Given 하루에 할 일 하나씩만 끝낸 기록
    const twoDays = withActiveDays('2026-10-25', '2026-10-26');

    // When 셋째 날 할 일을 끝낸다
    const threeDays = StoreReviewTransitions.recordActiveDay(twoDays, '2026-10-27');

    // Then
    expect(STORE_REVIEW_MIN_ACTIVE_DAYS).toBe(3);
    expect(StoreReviewPolicy.evaluate(twoDays, NOW)).toBe('not_engaged');
    expect(StoreReviewPolicy.evaluate(threeDays, NOW)).toBe('eligible');
  });

  it('같은 날 여러 번 끝내도 하루로만 센다', () => {
    // Given
    const sameDay = withActiveDays('2026-10-27', '2026-10-27', '2026-10-27', '2026-10-26');

    // When
    const eligibility = StoreReviewPolicy.evaluate(sameDay, NOW);

    // Then
    expect(sameDay.activeDays).toEqual(['2026-10-27', '2026-10-26']);
    expect(eligibility).toBe('not_engaged');
  });

  it('마지막 요청 뒤 120일이 지나기 전에는 다시 요청하지 않는다', () => {
    // Given
    const justBefore: StoreReviewState = {
      ...ENGAGED,
      requestedAt: [new Date(daysBefore(STORE_REVIEW_REQUEST_COOLDOWN_DAYS).getTime() + 1)],
    };
    const elapsed: StoreReviewState = {
      ...ENGAGED,
      requestedAt: [daysBefore(STORE_REVIEW_REQUEST_COOLDOWN_DAYS)],
    };

    // When / Then
    expect(StoreReviewPolicy.evaluate(justBefore, NOW)).toBe('cooling_down');
    expect(StoreReviewPolicy.evaluate(elapsed, NOW)).toBe('eligible');
  });

  it('최근 365일 안에 세 번 요청했으면 쿨다운이 지나도 요청하지 않는다', () => {
    // Given
    const threeInWindow: StoreReviewState = {
      ...ENGAGED,
      requestedAt: [daysBefore(364), daysBefore(244), daysBefore(124)],
    };
    const oldestLeftWindow: StoreReviewState = {
      ...ENGAGED,
      requestedAt: [daysBefore(STORE_REVIEW_REQUEST_WINDOW_DAYS), daysBefore(244), daysBefore(124)],
    };

    // When / Then
    expect(STORE_REVIEW_MAX_REQUESTS_PER_WINDOW).toBe(3);
    expect(StoreReviewPolicy.evaluate(threeInWindow, NOW)).toBe('window_limit_reached');
    expect(StoreReviewPolicy.evaluate(oldestLeftWindow, NOW)).toBe('eligible');
  });
});

describe('StoreReviewTransitions.recordRequest', () => {
  it('요청 시각을 쌓고 365일 창 밖의 기록은 지운다', () => {
    // Given
    const state: StoreReviewState = { ...ENGAGED, requestedAt: [daysBefore(400), daysBefore(130)] };

    // When
    const next = StoreReviewTransitions.recordRequest(state, NOW);

    // Then
    expect(next.requestedAt).toEqual([daysBefore(130), NOW]);
  });
});

describe('StoreReviewPolicy.settleDelayMs', () => {
  it('축하 화면이 가라앉도록 순간마다 1초 이상 기다린다', () => {
    expect(StoreReviewPolicy.settleDelayMs('all_todos_done')).toBeGreaterThanOrEqual(1_000);
    expect(StoreReviewPolicy.settleDelayMs('paw_print_celebration')).toBeGreaterThanOrEqual(1_000);
  });
});
