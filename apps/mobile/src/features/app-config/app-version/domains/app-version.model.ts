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

function compareVersions(current: string, latest: string) {
  const left = current.split('.').map(Number);
  const right = latest.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

/** 점검이 켜져 있고 플랫폼과 두 버전이 모두 올바를 때만 판정한다. 아니면 어떤 안내도 하지 않는다 */
function canCompareVersions(input: AppVersionPolicyInput): input is ComparableInput {
  const { config, platform, currentVersion } = input;
  if (config?.enabled !== true || !appVersionPlatformSchema.safeParse(platform).success) {
    return false;
  }
  const latest = platform === 'ios' ? config.latestByPlatform.ios : config.latestByPlatform.android;

  return isValidVersion(currentVersion) && isValidVersion(latest);
}

function isBehindLatest(input: ComparableInput) {
  return compareVersions(input.currentVersion, input.config.latestByPlatform[input.platform]) < 0;
}

/** 스토어에 더 새 버전이 있다 */
function isOutdated(input: AppVersionPolicyInput) {
  return canCompareVersions(input) && isBehindLatest(input);
}

/** 판정할 수 있고 이미 최신이거나 더 앞선 빌드다 */
function isUpToDate(input: AppVersionPolicyInput) {
  return canCompareVersions(input) && !isBehindLatest(input);
}

export const AppVersionPolicy = { canCompareVersions, isOutdated, isUpToDate } as const;
