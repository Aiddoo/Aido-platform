import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as Sentry from '@sentry/react-native';

import { createSentryLogger, logEventFeature } from './sentry-logger';

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

const addBreadcrumb = jest.mocked(Sentry.addBreadcrumb);
const captureException = jest.mocked(Sentry.captureException);

describe('createSentryLogger', () => {
  beforeEach(() => {
    addBreadcrumb.mockClear();
    captureException.mockClear();
  });

  it('debug는 Sentry에 아무것도 남기지 않는다', () => {
    // When
    createSentryLogger().debug('nope', { memoId: 1 });

    // Then
    expect(addBreadcrumb).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('info/warn은 level 매핑된 breadcrumb로 남는다', () => {
    // Given
    const logger = createSentryLogger();

    // When
    logger.info('hello', { memoId: 1 });
    logger.warn('careful');

    // Then
    expect(addBreadcrumb).toHaveBeenNthCalledWith(1, {
      level: 'info',
      message: 'hello',
      data: { memoId: 1 },
    });
    expect(addBreadcrumb).toHaveBeenNthCalledWith(2, {
      level: 'warning',
      message: 'careful',
      data: undefined,
    });
    expect(captureException).not.toHaveBeenCalled();
  });

  it('context는 승격 없이 그대로 breadcrumb data로 전달된다', () => {
    // When
    createSentryLogger().info('작업 완료', { memoId: 7 });

    // Then
    expect(addBreadcrumb).toHaveBeenCalledWith({
      level: 'info',
      message: '작업 완료',
      data: { memoId: 7 },
    });
  });

  it('error는 breadcrumb를 남기고, Error가 있으면 non-fatal로 수집한다', () => {
    // Given
    const logger = createSentryLogger();
    const error = new Error('boom');

    // When
    logger.error('failed', error, { feature: 'x' });

    // Then
    expect(addBreadcrumb).toHaveBeenCalledWith({
      level: 'error',
      message: 'failed',
      data: { feature: 'x' },
    });
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { source: 'logger' },
      extra: { loggerMessage: 'failed', feature: 'x' },
    });
  });

  it('error에 Error가 없으면 breadcrumb만 남기고 captureException은 호출하지 않는다', () => {
    // When
    createSentryLogger().error('just a message');

    // Then
    expect(addBreadcrumb).toHaveBeenCalledTimes(1);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('error의 message가 이벤트 키면 첫 마디를 feature 태그로 붙인다', () => {
    // Given
    const error = new Error('boom');

    // When
    createSentryLogger().error('todo-comment.submit.failed', error);

    // Then
    expect(captureException).toHaveBeenCalledWith(error, {
      tags: { source: 'logger', feature: 'todo_comment' },
      extra: { loggerMessage: 'todo-comment.submit.failed' },
    });
  });
});

describe('logEventFeature', () => {
  it.each([
    ['ai.response.parse-failed', 'ai'],
    ['todo-comment.submit.failed', 'todo_comment'],
    ['token-refresher.access-token-read.failed', 'token_refresher'],
  ])('이벤트 키 %s의 feature는 %s다', (message, feature) => {
    // When
    const result = logEventFeature(message);

    // Then
    expect(result).toBe(feature);
  });

  it.each(['failed', '[Notification] 실패', 'support_mail.open_failed', 'Todo.submit.failed'])(
    '이벤트 키 형식이 아닌 %s는 feature가 없다',
    (message) => {
      // When
      const result = logEventFeature(message);

      // Then
      expect(result).toBeUndefined();
    },
  );

  it('ERROR_REPORT_FEATURES에 없는 첫 마디는 태그로 보내지 않는다', () => {
    // When
    const result = logEventFeature('unknown-feature.submit.failed');

    // Then
    expect(result).toBeUndefined();
  });

  it('로그 이벤트 상수의 첫 마디는 모두 ERROR_REPORT_FEATURES에 있다', () => {
    // Given
    const srcRoot = join(__dirname, '../../..');
    const logEventKeys = readdirSync(srcRoot, { recursive: true, encoding: 'utf8' })
      .filter((path) => path.endsWith('log-events.ts'))
      .flatMap((path) =>
        [...readFileSync(join(srcRoot, path), 'utf8').matchAll(/: '([a-z0-9.-]+)'/g)].map(
          ([, key]) => key ?? '',
        ),
      );

    // When
    const keysWithoutFeature = logEventKeys.filter((key) => logEventFeature(key) == null);

    // Then
    expect(logEventKeys.length).toBeGreaterThan(0);
    expect(keysWithoutFeature).toEqual([]);
  });
});
