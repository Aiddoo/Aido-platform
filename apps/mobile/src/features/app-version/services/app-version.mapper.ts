import type { AppVersionResponse } from '@aido/api';

import type { AppVersionConfig } from '../models/app-version.model';

export const toAppVersionConfig = (response: AppVersionResponse): AppVersionConfig =>
  response.enabled
    ? {
        enabled: true,
        latestByPlatform: {
          ios: response.ios.latestVersion,
          android: response.android.latestVersion,
        },
      }
    : { enabled: false };
