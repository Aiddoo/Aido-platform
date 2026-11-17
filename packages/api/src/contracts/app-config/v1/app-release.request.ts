import { z } from "zod";

import {
  APP_PLATFORMS,
  APP_STORE_VERSION_MAX_LENGTH,
} from "../../../vocabulary/app-version.constants.js";
import { appStoreVersionSchema } from "./app-version.response.js";

export const publishAppReleaseParamSchema = z.object({
  platform: z
    .enum(APP_PLATFORMS)
    .meta({ description: "버전을 공개한 스토어 (ios: App Store | android: Google Play)" }),
});

export type PublishAppReleaseParam = z.infer<typeof publishAppReleaseParamSchema>;

export const publishAppReleaseSchema = z
  .object({
    latestVersion: appStoreVersionSchema.max(APP_STORE_VERSION_MAX_LENGTH).meta({
      description: "그 스토어에서 실제로 업데이트를 받을 수 있는 최신 버전 (MAJOR.MINOR.PATCH)",
    }),
  })
  .meta({ example: { latestVersion: "1.15.2" } });

export type PublishAppReleaseInput = z.infer<typeof publishAppReleaseSchema>;
