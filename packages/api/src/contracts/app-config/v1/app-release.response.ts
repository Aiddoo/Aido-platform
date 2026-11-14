import { z } from "zod";

import { datetimeSchema } from "../../../common/datetime.js";
import { APP_PLATFORMS } from "../../../vocabulary/app-version.constants.js";
import { appStoreVersionSchema } from "./app-version.response.js";

export const appReleaseSchema = z.object({
  platform: z.enum(APP_PLATFORMS).describe("스토어 (ios: App Store | android: Google Play)"),
  latestVersion: appStoreVersionSchema.describe("스토어에 공개된 최신 버전 (MAJOR.MINOR.PATCH)"),
  updatedAt: datetimeSchema.describe("이 버전을 반영한 시각 (ISO 8601 UTC)"),
});

export const publishAppReleaseResponseSchema = z.object({ appRelease: appReleaseSchema }).meta({
  example: {
    appRelease: {
      platform: "ios",
      latestVersion: "1.15.2",
      updatedAt: "2026-11-14T09:00:00.000Z",
    },
  },
});

export type PublishAppReleaseResponse = z.infer<typeof publishAppReleaseResponseSchema>;
