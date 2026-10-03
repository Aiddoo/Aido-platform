import {
  featureDiscoveryConfigSchema,
  type FeatureDiscoveryConfig,
} from '@src/features/feature-discovery/models/feature-discovery.model';
import {
  FEATURE_DISCOVERY_CAMPAIGN_ID,
  FEATURE_DISCOVERY_CAMPAIGN_LAUNCHED_AT,
} from '@src/features/feature-discovery/models/feature-discovery.registry';
import { userSchema } from '@src/features/user/models/user.model';
import { z } from 'zod';

const DAY_MS = 24 * 60 * 60 * 1000;
export const ACTIVATION_CHECKLIST_WINDOW_MS = 7 * DAY_MS;

const activationProgressSchema = z.object({
  todoCreatedAt: z.date().nullable(),
  activatedAt: z.date().nullable(),
  pushRegistrationUnlockedAt: z.date().nullable(),
});
export type ActivationProgress = z.infer<typeof activationProgressSchema>;
const activationIdentitySchema = z.object({ accountId: z.string(), campaignId: z.string() });
export type ActivationIdentity = z.infer<typeof activationIdentitySchema>;
const activationUserSchema = userSchema.pick({ id: true, createdAt: true });
export type ActivationUser = z.infer<typeof activationUserSchema>;
const pushRegistrationInputSchema = z.object({
  config: featureDiscoveryConfigSchema.optional(),
  user: activationUserSchema.optional(),
  progress: activationProgressSchema,
});
type PushRegistrationInput = z.infer<typeof pushRegistrationInputSchema>;
const checklistVisibilityInputSchema = pushRegistrationInputSchema.extend({ now: z.date() });
type ChecklistVisibilityInput = z.infer<typeof checklistVisibilityInputSchema>;

function resolveEnabledCampaign(
  config: FeatureDiscoveryConfig,
): { campaignId: string; launchedAt: Date } | null {
  if (config.enabled && config.campaignId === FEATURE_DISCOVERY_CAMPAIGN_ID) {
    return {
      campaignId: config.campaignId,
      launchedAt: config.launchedAt,
    };
  }
  return null;
}

function isNewUserCohort(
  config: FeatureDiscoveryConfig | undefined,
  user: ActivationUser | undefined,
): boolean {
  const campaign = config ? resolveEnabledCampaign(config) : null;
  return Boolean(campaign && user && user.createdAt.getTime() >= campaign.launchedAt.getTime());
}

function activationIdentity(
  config: FeatureDiscoveryConfig | undefined,
  user: ActivationUser | undefined,
): ActivationIdentity | null {
  const campaign = config ? resolveEnabledCampaign(config) : null;
  if (!campaign || !user || user.createdAt.getTime() < campaign.launchedAt.getTime()) {
    return null;
  }
  return {
    accountId: user.id,
    campaignId: campaign.campaignId,
  };
}

const isWithinTimeWindow = (createdAt: number, now: number, window: number): boolean => {
  const elapsed = now - createdAt;
  return elapsed >= 0 && elapsed < window;
};
const calculateElapsedDays = (createdAt: number, now: number): number =>
  Math.max(0, Math.floor((now - createdAt) / DAY_MS));

function isChecklistVisible({ config, user, progress, now }: ChecklistVisibilityInput): boolean {
  if (!isNewUserCohort(config, user) || !user || progress.activatedAt) {
    return false;
  }

  return isWithinTimeWindow(
    user.createdAt.getTime(),
    now.getTime(),
    ACTIVATION_CHECKLIST_WINDOW_MS,
  );
}

function shouldRegisterPushAutomatically({
  config,
  user,
  progress,
}: PushRegistrationInput): boolean {
  if (!user) {
    return false;
  }
  const isDeferredCohort =
    config === undefined
      ? user.createdAt.getTime() >= new Date(FEATURE_DISCOVERY_CAMPAIGN_LAUNCHED_AT).getTime()
      : isNewUserCohort(config, user);
  if (!isDeferredCohort) {
    return true;
  }
  return progress.activatedAt !== null || progress.pushRegistrationUnlockedAt !== null;
}

function daysSinceSignup(user: ActivationUser, now: Date): number {
  return calculateElapsedDays(user.createdAt.getTime(), now.getTime());
}

export const ActivationPolicy = {
  activationIdentity,
  daysSinceSignup,
  isChecklistVisible,
  isNewUserCohort,
  shouldRegisterPushAutomatically,
} as const;
