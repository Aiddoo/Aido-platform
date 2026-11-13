import { z } from "zod";

import { APP_STORE_VERSION_PATTERN } from "../../../vocabulary/app-version.constants.js";

export const appStoreVersionSchema = z
  .string()
  .regex(new RegExp(APP_STORE_VERSION_PATTERN), "Must be a stable MAJOR.MINOR.PATCH version");

const platformVersionSchema = z.strictObject({ latestVersion: appStoreVersionSchema });

export const appVersionResponseSchema = z.discriminatedUnion("enabled", [
  z.strictObject({ enabled: z.literal(false) }),
  z.strictObject({
    enabled: z.literal(true),
    ios: platformVersionSchema,
    android: platformVersionSchema,
  }),
]);

export type AppVersionResponse = z.infer<typeof appVersionResponseSchema>;
