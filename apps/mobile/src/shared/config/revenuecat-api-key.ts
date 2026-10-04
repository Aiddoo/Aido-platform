import { match } from 'ts-pattern';

type RevenueCatApiKeyContext = {
  isDebugBuild: boolean;
  isDevelopmentEnvironment: boolean;
  platform: string;
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
    .otherwise(() => undefined);

  // RevenueCat deliberately terminates Release builds configured with a Test Store key.
  return platformApiKey?.startsWith('test_') ? undefined : platformApiKey;
};
