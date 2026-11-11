import type { ConfigType } from "@nestjs/config";

import { defineConfig } from "#api/platform/config/define-config";
import { appVersionSchema } from "#api/platform/config/schemas/app-version.schema";

export const appConfigAppVersionsConfig = defineConfig(
  "appConfigAppVersions",
  appVersionSchema.transform((env) => ({
    enabled: env.APP_VERSION_CHECK_ENABLED,
    iosLatestVersion: env.APP_VERSION_CHECK_IOS_LATEST_VERSION,
    androidLatestVersion: env.APP_VERSION_CHECK_ANDROID_LATEST_VERSION,
  })),
  (env) => ({
    APP_VERSION_CHECK_ENABLED: env.APP_VERSION_CHECK_ENABLED,
    APP_VERSION_CHECK_IOS_LATEST_VERSION: env.APP_VERSION_CHECK_IOS_LATEST_VERSION,
    APP_VERSION_CHECK_ANDROID_LATEST_VERSION: env.APP_VERSION_CHECK_ANDROID_LATEST_VERSION,
  }),
);

export type AppConfigAppVersionsConfig = ConfigType<typeof appConfigAppVersionsConfig>;
