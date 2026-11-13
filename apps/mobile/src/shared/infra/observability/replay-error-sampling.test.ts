import type { Event } from '@sentry/react-native';

import { shouldCaptureErrorReplay } from './replay-error-sampling';

describe('shouldCaptureErrorReplay', () => {
  it.each<{ name: string; event: Event }>([
    {
      name: '강제 종료',
      event: {
        level: 'fatal',
        exception: { values: [{ mechanism: { type: 'onerror', handled: false } }] },
      },
    },
    {
      name: '잡지 못한 Promise 거부',
      event: {
        level: 'error',
        exception: { values: [{ mechanism: { type: 'onunhandledrejection', handled: false } }] },
      },
    },
  ])('$name은 오류 녹화를 보낸다', ({ event }) => {
    // When
    const shouldCapture = shouldCaptureErrorReplay(event);

    // Then
    expect(shouldCapture).toBe(true);
  });

  it.each<{ name: string; event: Event }>([
    {
      name: 'captureException으로 보고한 오류',
      event: {
        level: 'error',
        exception: { values: [{ mechanism: { type: 'generic', handled: true } }] },
      },
    },
    { name: 'mechanism이 없는 오류', event: { level: 'error', exception: { values: [{}] } } },
  ])('$name은 오류 녹화를 보내지 않는다', ({ event }) => {
    // When
    const shouldCapture = shouldCaptureErrorReplay(event);

    // Then
    expect(shouldCapture).toBe(false);
  });
});
