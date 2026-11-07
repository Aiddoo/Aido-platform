import { fromEpochMs, toEpochMs, toInstant } from '@src/shared/date/instant';

import { createDiagnosticCode } from './create-diagnostic-code';

describe('createDiagnosticCode', () => {
  it('플랫폼·앱 버전·발생 시각만으로 코드를 만든다', () => {
    // Given
    const occurredAt = toInstant('2026-11-03T00:00:00.000Z');

    // When
    const code = createDiagnosticCode({ platform: 'ios', appVersion: '1.14.0', occurredAt });

    // Then
    expect(code).toBe(`IOS-1.14.0-${toEpochMs(occurredAt).toString(36).toUpperCase()}`);
  });

  it('앱 버전을 읽지 못하면 unknown으로 둔다', () => {
    // Given / When
    const code = createDiagnosticCode({
      platform: 'android',
      appVersion: null,
      occurredAt: fromEpochMs(0),
    });

    // Then
    expect(code).toBe('ANDROID-unknown-0');
  });
});
