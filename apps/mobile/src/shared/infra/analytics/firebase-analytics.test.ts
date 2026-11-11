import {
  resetAnalyticsData,
  setUserId,
  setUserProperties,
  setUserProperty,
} from '@react-native-firebase/analytics';
import { createLoggerStub } from '@src/testing/ports/logger.stub';

import { createFirebaseAnalytics } from './firebase-analytics';

const mockGetAnalytics = jest.fn<void, []>();
const mockAnalyticsLogEvent = jest.fn<Promise<void>, [string, Record<string, unknown>?]>();
const mockFirebaseAnalytics = { logEvent: mockAnalyticsLogEvent };

// 모듈 mock은 실제 instance 타입을 요구하지 않으므로 adapter가 쓰는 logEvent만 가진 fake를 돌려준다.
jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: () => {
    mockGetAnalytics();
    return mockFirebaseAnalytics;
  },
  resetAnalyticsData: jest.fn(),
  setUserId: jest.fn(),
  setUserProperties: jest.fn(),
  setUserProperty: jest.fn(),
}));

const mockResetAnalyticsData = jest.mocked(resetAnalyticsData);
const mockSetUserId = jest.mocked(setUserId);
const mockSetUserProperty = jest.mocked(setUserProperty);
const mockSetUserProperties = jest.mocked(setUserProperties);

describe('createFirebaseAnalytics', () => {
  beforeEach(() => {
    mockAnalyticsLogEvent.mockResolvedValue(undefined);
    mockSetUserId.mockResolvedValue(undefined);
    mockSetUserProperty.mockResolvedValue(undefined);
    mockSetUserProperties.mockResolvedValue(undefined);
    mockResetAnalyticsData.mockResolvedValue(undefined);
  });

  it('이벤트와 화면 조회를 Promise가 보존되는 Analytics instance로 기록한다', () => {
    // Given
    const analytics = createFirebaseAnalytics(createLoggerStub());

    // When
    analytics.trackEvent('todo_created', { source: 'quick_add' });
    analytics.trackScreenView('TodoDetail', { todo_id: 'todo-1' });

    // Then
    expect(mockGetAnalytics).toHaveBeenCalledTimes(1);
    expect(mockAnalyticsLogEvent).toHaveBeenNthCalledWith(1, 'todo_created', {
      source: 'quick_add',
    });
    expect(mockAnalyticsLogEvent).toHaveBeenNthCalledWith(2, 'screen_view', {
      screen_name: 'TodoDetail',
      screen_class: 'TodoDetail',
      todo_id: 'todo-1',
    });
  });

  it('동기 logEvent 예외를 포트 밖으로 전파하지 않고 맥락과 함께 로깅한다', () => {
    // Given
    const logger = createLoggerStub();
    const analytics = createFirebaseAnalytics(logger);
    mockAnalyticsLogEvent.mockImplementation(() => {
      throw new Error('invalid event');
    });

    // When
    expect(() => analytics.trackEvent('invalid-event')).not.toThrow();

    // Then
    expect(logger.warn).toHaveBeenCalledWith('firebase-analytics.track-event.failed', {
      eventName: 'invalid-event',
      error: 'invalid event',
    });
  });

  it('이벤트 전송 Promise rejection을 fire-and-forget 포트 밖으로 전파하지 않는다', async () => {
    // Given
    const logger = createLoggerStub();
    const analytics = createFirebaseAnalytics(logger);
    mockAnalyticsLogEvent.mockRejectedValueOnce(new Error('native event rejected'));

    // When
    expect(() => analytics.trackEvent('todo_created')).not.toThrow();
    await Promise.resolve();

    // Then
    expect(logger.warn).toHaveBeenCalledWith('firebase-analytics.track-event.failed', {
      eventName: 'todo_created',
      error: 'native event rejected',
    });
  });

  it('화면 조회의 동기 예외를 화면 맥락과 함께 로깅한다', () => {
    // Given
    const logger = createLoggerStub();
    const analytics = createFirebaseAnalytics(logger);
    mockAnalyticsLogEvent.mockImplementation(() => {
      throw new Error('invalid screen');
    });

    // When
    expect(() => analytics.trackScreenView('TodoDetail')).not.toThrow();

    // Then
    expect(logger.warn).toHaveBeenCalledWith('firebase-analytics.track-screen-view.failed', {
      screenName: 'TodoDetail',
      error: 'invalid screen',
    });
  });

  it('사용자 식별 Promise rejection을 fire-and-forget 포트 밖으로 전파하지 않는다', async () => {
    // Given
    const logger = createLoggerStub();
    const analytics = createFirebaseAnalytics(logger);
    mockSetUserId.mockRejectedValueOnce(new Error('native rejected'));

    // When
    expect(() => analytics.setUserId('user-1')).not.toThrow();
    await Promise.resolve();

    // Then
    expect(logger.warn).toHaveBeenCalledWith('firebase-analytics.set-user-id.failed', {
      error: 'native rejected',
    });
  });

  it('사용자 식별 API의 동기 인자 검증 예외도 포트 밖으로 전파하지 않는다', () => {
    // Given
    const logger = createLoggerStub();
    const analytics = createFirebaseAnalytics(logger);
    mockSetUserId.mockImplementationOnce(() => {
      throw new Error('invalid user id');
    });

    // When
    expect(() => analytics.setUserId('invalid-user')).not.toThrow();

    // Then
    expect(logger.warn).toHaveBeenCalledWith('firebase-analytics.set-user-id.failed', {
      error: 'invalid user id',
    });
  });

  it('사용자 속성 값을 문자열로 변환하고 실패한 key를 로깅한다', async () => {
    // Given
    const logger = createLoggerStub();
    const analytics = createFirebaseAnalytics(logger);
    mockSetUserProperty.mockRejectedValueOnce(new Error('property rejected'));

    // When
    analytics.setUserProperties({
      is_premium: true,
      subscription_status: 'ACTIVE',
      premium_source: 'store',
    });
    await Promise.resolve();

    // Then
    expect(mockSetUserProperty).toHaveBeenNthCalledWith(
      1,
      mockFirebaseAnalytics,
      'is_premium',
      'true',
    );
    expect(mockSetUserProperty).toHaveBeenNthCalledWith(
      3,
      mockFirebaseAnalytics,
      'premium_source',
      'store',
    );
    expect(logger.warn).toHaveBeenCalledWith('firebase-analytics.set-user-property.failed', {
      key: 'is_premium',
      error: 'property rejected',
    });
  });

  it('로그아웃하면 사용자 id와 모든 사용자 속성을 지워 다음 계정에 남기지 않는다', () => {
    // Given
    const analytics = createFirebaseAnalytics(createLoggerStub());

    // When
    analytics.clearUser();

    // Then
    expect(mockSetUserId).toHaveBeenCalledWith(mockFirebaseAnalytics, null);
    expect(mockSetUserProperties).toHaveBeenCalledWith(mockFirebaseAnalytics, {
      is_premium: null,
      subscription_status: null,
      premium_source: null,
    });
  });

  it('reset Promise rejection을 로깅한다', async () => {
    // Given
    const logger = createLoggerStub();
    const analytics = createFirebaseAnalytics(logger);
    mockResetAnalyticsData.mockRejectedValueOnce(new Error('reset rejected'));

    // When
    analytics.resetData();
    await Promise.resolve();

    // Then
    expect(mockResetAnalyticsData).toHaveBeenCalledWith(mockFirebaseAnalytics);
    expect(logger.warn).toHaveBeenCalledWith('firebase-analytics.reset-data.failed', {
      error: 'reset rejected',
    });
  });
});
