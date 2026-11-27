import {
  APP_PLATFORMS,
  APP_STORE_VERSION_PATTERN,
  compareSemanticVersions,
} from '@aido/api/vocabulary';
import { z } from 'zod';

const appStoreVersionSchema = z.string().regex(new RegExp(APP_STORE_VERSION_PATTERN));

const appVersionPlatformSchema = z.enum(APP_PLATFORMS);

export const appVersionConfigSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    latestByPlatform: z.object({
      ios: appStoreVersionSchema,
      android: appStoreVersionSchema,
    }),
  }),
]);
export type AppVersionConfig = z.infer<typeof appVersionConfigSchema>;

/** 이 기기에 깔린 앱. 네이티브가 주지 않으면 플랫폼·버전이 null이다 */
interface AppInstallation {
  platform: string | null;
  currentVersion: string | null;
}

type AppVersionUpdateStatus = 'unknown' | 'outdated' | 'up-to-date';

function isValidVersion(version: string | null): version is string {
  return appStoreVersionSchema.safeParse(version).success;
}

export const AppVersionPolicy = {
  /** 점검이 꺼졌거나 플랫폼·버전이 올바르지 않으면 어떤 안내도 하지 않도록 `unknown`이다 */
  getUpdateStatus(config: AppVersionConfig, installation: AppInstallation): AppVersionUpdateStatus {
    const platform = appVersionPlatformSchema.safeParse(installation.platform);
    if (!config.enabled || !platform.success) {
      return 'unknown';
    }
    const latestVersion = config.latestByPlatform[platform.data];
    const { currentVersion } = installation;
    if (!isValidVersion(currentVersion) || !isValidVersion(latestVersion)) {
      return 'unknown';
    }
    const difference = compareSemanticVersions(currentVersion, latestVersion);

    return difference != null && difference < 0 ? 'outdated' : 'up-to-date';
  },
};
