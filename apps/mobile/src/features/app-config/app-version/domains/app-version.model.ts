import {
  APP_PLATFORMS,
  APP_STORE_VERSION_PATTERN,
  compareSemanticVersions,
} from '@aido/api/vocabulary';
import { z } from 'zod';

const appStoreVersionSchema = z.string().regex(new RegExp(APP_STORE_VERSION_PATTERN));

const appVersionPlatformSchema = z.enum(APP_PLATFORMS);
type AppVersionPlatform = z.infer<typeof appVersionPlatformSchema>;

const enabledAppVersionConfigSchema = z.object({
  enabled: z.literal(true),
  latestByPlatform: z.object({
    ios: appStoreVersionSchema,
    android: appStoreVersionSchema,
  }),
});
type EnabledAppVersionConfig = z.infer<typeof enabledAppVersionConfigSchema>;

export const appVersionConfigSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }),
  enabledAppVersionConfigSchema,
]);
export type AppVersionConfig = z.infer<typeof appVersionConfigSchema>;

/** 설치 정보를 모르면 플랫폼·버전이 null이다 */
export interface AppVersionPolicyInput {
  config: AppVersionConfig;
  platform: string | null;
  currentVersion: string | null;
}

interface ComparableInput {
  config: EnabledAppVersionConfig;
  platform: AppVersionPlatform;
  currentVersion: string;
}

function isValidVersion(version: string | null | undefined): version is string {
  return appStoreVersionSchema.safeParse(version).success;
}

/** 점검이 켜져 있고 플랫폼과 두 버전이 모두 올바를 때만 판정한다. 아니면 어떤 안내도 하지 않는다 */
function isVersionComparable(input: AppVersionPolicyInput): input is ComparableInput {
  const { config, platform, currentVersion } = input;
  const parsedPlatform = appVersionPlatformSchema.safeParse(platform);
  if (!config.enabled || !parsedPlatform.success) {
    return false;
  }
  const latest = config.latestByPlatform[parsedPlatform.data];

  return isValidVersion(currentVersion) && isValidVersion(latest);
}

function isBehindLatest(input: ComparableInput) {
  const difference = compareSemanticVersions(
    input.currentVersion,
    input.config.latestByPlatform[input.platform],
  );

  return difference != null && difference < 0;
}

type AppVersionUpdateStatus = 'unknown' | 'outdated' | 'up-to-date';

/** 판정할 수 없으면 `unknown`이다. 스토어에 더 새 버전이 있으면 `outdated`, 이미 최신이거나 더 앞선 빌드면 `up-to-date`다 */
function getUpdateStatus(input: AppVersionPolicyInput): AppVersionUpdateStatus {
  if (!isVersionComparable(input)) {
    return 'unknown';
  }

  return isBehindLatest(input) ? 'outdated' : 'up-to-date';
}

export const AppVersionPolicy = { getUpdateStatus } as const;
