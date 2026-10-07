import { appStoreVersionSchema } from "@aido/api";
import { z } from "zod";

export const appVersionSchema = z.object({
  APP_VERSION_CHECK_ENABLED: z.stringbool().default(false),
  APP_VERSION_CHECK_IOS_LATEST_VERSION: z.string().optional(),
  APP_VERSION_CHECK_ANDROID_LATEST_VERSION: z.string().optional(),
});

export function validateAppVersionConfig(config: AppVersionConfig, context: z.RefinementCtx): void {
  if (!config.APP_VERSION_CHECK_ENABLED) return;

  for (const [key, value] of [
    ["APP_VERSION_CHECK_IOS_LATEST_VERSION", config.APP_VERSION_CHECK_IOS_LATEST_VERSION],
    ["APP_VERSION_CHECK_ANDROID_LATEST_VERSION", config.APP_VERSION_CHECK_ANDROID_LATEST_VERSION],
  ] as const) {
    if (!appStoreVersionSchema.safeParse(value).success) {
      context.addIssue({
        code: "custom",
        path: [key],
        message: `${key} must be a stable MAJOR.MINOR.PATCH version when APP_VERSION_CHECK_ENABLED is true`,
      });
    }
  }
}

export type AppVersionConfig = z.infer<typeof appVersionSchema>;
