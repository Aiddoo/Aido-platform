import type { AppVersionResponse } from '@aido/api';

import type { AppVersionConfig } from '../domains/app-version.model';

export function toAppVersionConfig(dto: AppVersionResponse): AppVersionConfig {
  return dto.enabled
    ? {
        enabled: true,
        latestByPlatform: { ios: dto.ios.latestVersion, android: dto.android.latestVersion },
      }
    : { enabled: false };
}
