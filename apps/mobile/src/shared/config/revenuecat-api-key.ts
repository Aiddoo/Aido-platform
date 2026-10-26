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

export const resolveRevenueCatApiKey = (context: RevenueCatApiKeyContext): string | undefined => {
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
};
