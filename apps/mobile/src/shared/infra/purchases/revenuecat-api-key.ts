import Constants from 'expo-constants';
import type { PlatformOSType } from 'react-native';
import { match } from 'ts-pattern';
import { z } from 'zod';

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

const revenueCatExtraSchema = z.object({
  isDevelopment: z.boolean(),
  revenueCatAppleApiKey: z.string().optional(),
  revenueCatGoogleApiKey: z.string().optional(),
  revenueCatTestApiKey: z.string().optional(),
});

export function getRevenueCatApiKey(): string | undefined {
  const extra = revenueCatExtraSchema.parse(Constants.expoConfig?.extra);

  return resolveRevenueCatApiKey({
    isDebugBuild: __DEV__,
    isDevelopmentEnvironment: extra.isDevelopment,
    platform: process.env.EXPO_OS,
    appleApiKey: extra.revenueCatAppleApiKey,
    googleApiKey: extra.revenueCatGoogleApiKey,
    testApiKey: extra.revenueCatTestApiKey,
  });
}
