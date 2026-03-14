import { createMockAnalytics } from '@src/shared/__tests__';
import { track } from '../track';

describe('track', () => {
  let analytics: ReturnType<typeof createMockAnalytics>;

  beforeEach(() => {
    analytics = createMockAnalytics();
  });

  test('이벤트명과 파라미터를 analytics.trackEvent에 전달한다', () => {
    // Given
    const params = { method: 'google' as const };

    // When
    track(analytics, 'auth_login', params);

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_login', params);
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
  });

  test('파라미터가 없는 이벤트는 params 없이 호출한다', () => {
    // Given & When
    track(analytics, 'auth_logout');

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('auth_logout', undefined);
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
  });

  test('복합 파라미터를 가진 이벤트를 올바르게 전달한다', () => {
    // Given
    const params = {
      source: 'manual' as const,
      is_recurring: false,
      has_scheduled_time: false,
      is_all_day: true,
      visibility: 'PUBLIC' as const,
    };

    // When
    track(analytics, 'todo_created', params);

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('todo_created', params);
  });

  test('badge_summary_viewed 이벤트가 올바른 파라미터로 전달된다', () => {
    // Given
    const params = {
      badge_type: 'perfect' as const,
      completion_rate: 100,
      week_label: '1월 1주차',
    };

    // When
    track(analytics, 'badge_summary_viewed', params);

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('badge_summary_viewed', params);
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
  });

  test('badge_empty_cta_tapped 이벤트는 params 없이 호출한다', () => {
    // Given & When
    track(analytics, 'badge_empty_cta_tapped');

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('badge_empty_cta_tapped', undefined);
    expect(analytics.trackEvent).toHaveBeenCalledTimes(1);
  });
});
