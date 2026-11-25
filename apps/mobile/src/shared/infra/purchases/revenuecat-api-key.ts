import { ENV } from '@src/shared/config/env';
import type { PlatformOSType } from 'react-native';
import { match } from 'ts-pattern';

type RevenueCatApiKeyContext = {
  isDebugBuild: boolean;
  isDevelopmentEnvironment: boolean;
  platform: PlatformOSType;
  appleApiKey?: string;
  googleApiKey?: string;
  testApiKey?: string;
};

export function resolveRevenueCatApiKey(context: RevenueCatApiKeyContext): string | undefined {
  if (context.isDebugBuild && context.isDevelopmentEnvironment) {
    return context.testApiKey;
  }

  const platformApiKey = match(context.platform)
    .with('ios', () => context.appleApiKey)
    .with('android', () => context.googleApiKey)
    .with('macos', 'windows', 'web', 'native', () => undefined)
    .exhaustive();

  // RevenueCat deliberately terminates Release builds configured with a Test Store key.
  return platformApiKey?.startsWith('test_') ? undefined : platformApiKey;
}

export function getRevenueCatApiKey(): string | undefined {
  return resolveRevenueCatApiKey({
    isDebugBuild: __DEV__,
    isDevelopmentEnvironment: ENV.APP_ENV === 'development',
    platform: process.env.EXPO_OS,
    appleApiKey: ENV.REVENUECAT_API_KEYS.apple,
    googleApiKey: ENV.REVENUECAT_API_KEYS.google,
    testApiKey: ENV.REVENUECAT_API_KEYS.test,
  });
}
