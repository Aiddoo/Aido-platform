import * as Sentry from '@sentry/react-native';
import { createSentryLogger } from './sentry-logger';

jest.mock('@sentry/react-native', () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

const addBreadcrumb = Sentry.addBreadcrumb as jest.Mock;
const captureException = Sentry.captureException as jest.Mock;

describe('createSentryLogger', () => {
  beforeEach(() => {
    addBreadcrumb.mockClear();
    captureException.mockClear();
  });

  it('debug는 Sentry에 아무것도 남기지 않는다', () => {
    createSentryLogger().debug('nope', { a: 1 });

    expect(addBreadcrumb).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('info/warn은 level 매핑된 breadcrumb로 남는다', () => {
    const logger = createSentryLogger();

    logger.info('hello', { a: 1 });
    logger.warn('careful');

    expect(addBreadcrumb).toHaveBeenNthCalledWith(1, {
      level: 'info',
      message: 'hello',
      data: { a: 1 },
    });
    expect(addBreadcrumb).toHaveBeenNthCalledWith(2, {
      level: 'warning',
      message: 'careful',
      data: undefined,
    });
    expect(captureException).not.toHaveBeenCalled();
  });

  it('context는 그대로 breadcrumb data로 전달된다(카테고리 승격 없음)', () => {
    createSentryLogger().info('작업 완료', { jobId: 7 });

    expect(addBreadcrumb).toHaveBeenCalledWith({
      level: 'info',
      message: '작업 완료',
      data: { jobId: 7 },
    });
  });

  it('error는 breadcrumb를 남기고, Error가 있으면 non-fatal로 수집한다', () => {
    const logger = createSentryLogger();
    const error = new Error('boom');

    logger.error('failed', error, { feature: 'x' });

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
    createSentryLogger().error('just a message');

    expect(addBreadcrumb).toHaveBeenCalledTimes(1);
    expect(captureException).not.toHaveBeenCalled();
  });
});
