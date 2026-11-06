import { appStoreVersionSchema } from '@aido/api';
import { z } from 'zod';

export { appStoreVersionSchema };

export const appVersionPlatformSchema = z.enum(['ios', 'android']);
export type AppVersionPlatform = z.infer<typeof appVersionPlatformSchema>;

const enabledAppVersionConfigSchema = z.strictObject({
  enabled: z.literal(true),
  latestByPlatform: z.strictObject({
    ios: appStoreVersionSchema,
    android: appStoreVersionSchema,
  }),
});
export type EnabledAppVersionConfig = z.infer<typeof enabledAppVersionConfigSchema>;

/** 서버가 점검을 끄면 `enabled: false`뿐이다. 그때는 안내하지 않는다 */
const appVersionConfigSchema = z.discriminatedUnion('enabled', [
  z.strictObject({ enabled: z.literal(false) }),
  enabledAppVersionConfigSchema,
]);
export type AppVersionConfig = z.infer<typeof appVersionConfigSchema>;
