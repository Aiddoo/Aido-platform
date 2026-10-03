import { appStoreVersionSchema } from '@aido/validators';
import { z } from 'zod';

export const appVersionPlatformSchema = z.enum(['ios', 'android']);
export const appVersionConfigSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }).strict(),
  z
    .object({
      enabled: z.literal(true),
      latestByPlatform: z
        .object({ ios: appStoreVersionSchema, android: appStoreVersionSchema })
        .strict(),
    })
    .strict(),
]);

export type AppVersionPlatform = z.infer<typeof appVersionPlatformSchema>;
export type AppVersionConfig = z.infer<typeof appVersionConfigSchema>;

const appVersionPolicyInputSchema = z.object({
  config: appVersionConfigSchema.optional(),
  platform: z.string().optional(),
  currentVersion: z.string().optional(),
});
export type AppVersionPolicyInput = z.infer<typeof appVersionPolicyInputSchema>;

type EnabledConfig = z.infer<(typeof appVersionConfigSchema.options)[1]>;
const decidableInputSchema = z.object({
  config: appVersionConfigSchema.options[1],
  platform: appVersionPlatformSchema,
  currentVersion: appStoreVersionSchema,
});
type DecidableInput = z.infer<typeof decidableInputSchema>;

const isEnabled = (config: AppVersionConfig | undefined): config is EnabledConfig =>
  config?.enabled === true;
const isSupportedPlatform = (platform: string | undefined): platform is AppVersionPlatform =>
  platform === 'ios' || platform === 'android';
const isValidVersion = (version: string | undefined): version is string =>
  appStoreVersionSchema.safeParse(version).success;
const compareVersions = (current: string, latest: string): number => {
  const left = current.split('.').map(Number);
  const right = latest.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
};
const canDecide = (input: AppVersionPolicyInput): input is DecidableInput =>
  isEnabled(input.config) &&
  isSupportedPlatform(input.platform) &&
  isValidVersion(input.currentVersion) &&
  isValidVersion(input.config.latestByPlatform[input.platform]);
const shouldOpenStore = (input: AppVersionPolicyInput): boolean =>
  canDecide(input) &&
  compareVersions(input.currentVersion, input.config.latestByPlatform[input.platform]) < 0;
const shouldShowLatestDialog = (input: AppVersionPolicyInput): boolean =>
  canDecide(input) &&
  compareVersions(input.currentVersion, input.config.latestByPlatform[input.platform]) >= 0;

export const AppVersionPolicy = { canDecide, shouldOpenStore, shouldShowLatestDialog } as const;
