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
    const params = { category_id: 1, has_due_date: true, source: 'manual' as const };

    // When
    track(analytics, 'todo_created', params);

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('todo_created', params);
  });
});
