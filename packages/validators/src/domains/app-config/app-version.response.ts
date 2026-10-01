import { z } from 'zod';

export const appStoreVersionPattern = '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$';

export const appStoreVersionSchema = z
  .string()
  .regex(new RegExp(appStoreVersionPattern), 'Must be a stable MAJOR.MINOR.PATCH version');

const platformVersionSchema = z.object({ latestVersion: appStoreVersionSchema }).strict();

export const appVersionResponseSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }).strict(),
  z
    .object({
      enabled: z.literal(true),
      ios: platformVersionSchema,
      android: platformVersionSchema,
    })
    .strict(),
]);

export type AppVersionResponse = z.infer<typeof appVersionResponseSchema>;
