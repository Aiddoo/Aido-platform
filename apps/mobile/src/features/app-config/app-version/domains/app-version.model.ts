import { compareSemanticVersions } from '@src/shared/utils/semantic-version';

import {
  type AppVersionConfig,
  type AppVersionPlatform,
  appStoreVersionSchema,
  appVersionPlatformSchema,
  type EnabledAppVersionConfig,
} from '../schemas/app-version.schema';

/** 설치 정보나 서버 설정이 모자랄 수 있어 모든 칸이 선택이다 */
export interface AppVersionPolicyInput {
  config?: AppVersionConfig;
  platform?: string;
  currentVersion?: string;
}

interface ComparableInput {
  config: EnabledAppVersionConfig;
  platform: AppVersionPlatform;
  currentVersion: string;
}

function isValidVersion(version: string | undefined): version is string {
  return appStoreVersionSchema.safeParse(version).success;
}

/** 점검이 켜져 있고 플랫폼과 두 버전이 모두 올바를 때만 판정한다. 아니면 어떤 안내도 하지 않는다 */
function isVersionComparable(input: AppVersionPolicyInput): input is ComparableInput {
  const { config, platform, currentVersion } = input;
  if (config?.enabled !== true || !appVersionPlatformSchema.safeParse(platform).success) {
    return false;
  }
  const latest = platform === 'ios' ? config.latestByPlatform.ios : config.latestByPlatform.android;

  return isValidVersion(currentVersion) && isValidVersion(latest);
}

function isBehindLatest(input: ComparableInput) {
  const difference = compareSemanticVersions(
    input.currentVersion,
    input.config.latestByPlatform[input.platform],
  );

  return difference != null && difference < 0;
}

/** 스토어에 더 새 버전이 있다 */
function isOutdated(input: AppVersionPolicyInput) {
  return isVersionComparable(input) && isBehindLatest(input);
}

/** 판정할 수 있고 이미 최신이거나 더 앞선 빌드다 */
function isUpToDate(input: AppVersionPolicyInput) {
  return isVersionComparable(input) && !isBehindLatest(input);
}

export const AppVersionPolicy = { isVersionComparable, isOutdated, isUpToDate } as const;
