import {
  getAnalytics,
  resetAnalyticsData,
  setUserId,
  setUserProperty,
} from '@react-native-firebase/analytics';
import type { Logger } from '@src/core/ports/logger';

import { createFirebaseAnalytics } from './firebase-analytics';

jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(),
  resetAnalyticsData: jest.fn(),
  setUserId: jest.fn(),
  setUserProperty: jest.fn(),
}));

const mockGetAnalytics = getAnalytics as jest.MockedFunction<typeof getAnalytics>;
const mockResetAnalyticsData = resetAnalyticsData as jest.MockedFunction<typeof resetAnalyticsData>;
const mockSetUserId = setUserId as jest.MockedFunction<typeof setUserId>;
const mockSetUserProperty = setUserProperty as jest.MockedFunction<typeof setUserProperty>;

const mockAnalyticsLogEvent = jest.fn<Promise<void>, [string, Record<string, unknown>?]>();
const firebaseAnalytics = {
  logEvent: mockAnalyticsLogEvent,
} as unknown as ReturnType<typeof getAnalytics>;

const createLogger = (): jest.Mocked<Logger> => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('createFirebaseAnalytics', () => {
  beforeEach(() => {
    mockGetAnalytics.mockReturnValue(firebaseAnalytics);
    mockAnalyticsLogEvent.mockResolvedValue(undefined);
    mockSetUserId.mockResolvedValue(undefined);
    mockSetUserProperty.mockResolvedValue(undefined);
    mockResetAnalyticsData.mockResolvedValue(undefined);
  });

  it('이벤트와 화면 조회를 Promise가 보존되는 Analytics instance로 기록한다', () => {
    const analytics = createFirebaseAnalytics(createLogger());

    analytics.trackEvent('todo_created', { source: 'quick_add' });
    analytics.trackScreenView('TodoDetail', { todo_id: 'todo-1' });

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
    const logger = createLogger();
    const analytics = createFirebaseAnalytics(logger);
    mockAnalyticsLogEvent.mockImplementation(() => {
      throw new Error('invalid event');
    });

    expect(() => analytics.trackEvent('invalid-event')).not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith('[FirebaseAnalytics] trackEvent failed', {
      eventName: 'invalid-event',
      error: 'invalid event',
    });
  });

  it('이벤트 전송 Promise rejection을 fire-and-forget 포트 밖으로 전파하지 않는다', async () => {
    const logger = createLogger();
    const analytics = createFirebaseAnalytics(logger);
    mockAnalyticsLogEvent.mockRejectedValueOnce(new Error('native event rejected'));

    expect(() => analytics.trackEvent('todo_created')).not.toThrow();
    await Promise.resolve();

    expect(logger.warn).toHaveBeenCalledWith('[FirebaseAnalytics] trackEvent failed', {
      eventName: 'todo_created',
      error: 'native event rejected',
    });
  });

  it('화면 조회의 동기 예외를 화면 맥락과 함께 로깅한다', () => {
    const logger = createLogger();
    const analytics = createFirebaseAnalytics(logger);
    mockAnalyticsLogEvent.mockImplementation(() => {
      throw new Error('invalid screen');
    });

    expect(() => analytics.trackScreenView('TodoDetail')).not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith('[FirebaseAnalytics] trackScreenView failed', {
      screenName: 'TodoDetail',
      error: 'invalid screen',
    });
  });

  it('사용자 식별 Promise rejection을 fire-and-forget 포트 밖으로 전파하지 않는다', async () => {
    const logger = createLogger();
    const analytics = createFirebaseAnalytics(logger);
    mockSetUserId.mockRejectedValueOnce(new Error('native rejected'));

    expect(() => analytics.setUserId('user-1')).not.toThrow();
    await Promise.resolve();

    expect(logger.warn).toHaveBeenCalledWith('[FirebaseAnalytics] setUserId failed', {
      error: 'native rejected',
    });
  });

  it('사용자 식별 API의 동기 인자 검증 예외도 포트 밖으로 전파하지 않는다', () => {
    const logger = createLogger();
    const analytics = createFirebaseAnalytics(logger);
    mockSetUserId.mockImplementationOnce(() => {
      throw new Error('invalid user id');
    });

    expect(() => analytics.setUserId('invalid-user')).not.toThrow();

    expect(logger.warn).toHaveBeenCalledWith('[FirebaseAnalytics] setUserId failed', {
      error: 'invalid user id',
    });
  });

  it('사용자 속성 값을 문자열로 변환하고 실패한 key를 로깅한다', async () => {
    const logger = createLogger();
    const analytics = createFirebaseAnalytics(logger);
    mockSetUserProperty.mockRejectedValueOnce(new Error('property rejected'));

    analytics.setUserProperties({ streak: 7, premium: true });
    await Promise.resolve();

    expect(mockSetUserProperty).toHaveBeenNthCalledWith(1, firebaseAnalytics, 'streak', '7');
    expect(mockSetUserProperty).toHaveBeenNthCalledWith(2, firebaseAnalytics, 'premium', 'true');
    expect(logger.warn).toHaveBeenCalledWith('[FirebaseAnalytics] setUserProperty failed', {
      key: 'streak',
      error: 'property rejected',
    });
  });

  it('reset Promise rejection을 로깅한다', async () => {
    const logger = createLogger();
    const analytics = createFirebaseAnalytics(logger);
    mockResetAnalyticsData.mockRejectedValueOnce(new Error('reset rejected'));

    analytics.resetData();
    await Promise.resolve();

    expect(mockResetAnalyticsData).toHaveBeenCalledWith(firebaseAnalytics);
    expect(logger.warn).toHaveBeenCalledWith('[FirebaseAnalytics] resetData failed', {
      error: 'reset rejected',
    });
  });
});
