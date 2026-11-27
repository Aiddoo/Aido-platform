import { type AppEnvironment, resolveTelemetryGates, type TelemetryGates } from './env';

describe('resolveTelemetryGates', () => {
  it.each<[AppEnvironment, boolean, TelemetryGates]>([
    [
      'production',
      false,
      { usesVendorAdapters: true, consoleMinLevel: 'warn', isSentrySdkEnabled: true },
    ],
    [
      'preview',
      false,
      { usesVendorAdapters: false, consoleMinLevel: 'debug', isSentrySdkEnabled: false },
    ],
    [
      'development',
      false,
      { usesVendorAdapters: false, consoleMinLevel: 'debug', isSentrySdkEnabled: false },
    ],
    [
      'preview',
      true,
      { usesVendorAdapters: false, consoleMinLevel: 'debug', isSentrySdkEnabled: true },
    ],
    [
      'development',
      true,
      { usesVendorAdapters: false, consoleMinLevel: 'debug', isSentrySdkEnabled: true },
    ],
  ])('%s(Sentry 디버그 %s)는 정해진 관측 도구를 켠다', (appEnv, sentryDebug, expected) => {
    // When
    const gates = resolveTelemetryGates({ appEnv, sentryDebug });
    // Then
    expect(gates).toEqual(expected);
  });
});
