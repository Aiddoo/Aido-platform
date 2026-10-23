import { z } from "zod";

export const appStoreVersionPattern = "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$";

export const appStoreVersionSchema = z
  .string()
  .regex(new RegExp(appStoreVersionPattern), "Must be a stable MAJOR.MINOR.PATCH version");

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
