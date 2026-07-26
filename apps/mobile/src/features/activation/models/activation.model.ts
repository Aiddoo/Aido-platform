import type { FeatureDiscoveryConfig } from '@src/features/feature-discovery/models/feature-discovery.model';
import {
  FEATURE_DISCOVERY_CAMPAIGN_ID,
  FEATURE_DISCOVERY_CAMPAIGN_LAUNCHED_AT,
} from '@src/features/feature-discovery/models/feature-discovery.registry';
import type { User } from '@src/features/user/models/user.model';

const DAY_MS = 24 * 60 * 60 * 1000;
export const ACTIVATION_CHECKLIST_WINDOW_MS = 7 * DAY_MS;

export interface ActivationProgress {
  todoCreatedAt: Date | null;
  activatedAt: Date | null;
  pushRegistrationUnlockedAt: Date | null;
}

export interface ActivationIdentity {
  accountId: string;
  campaignId: string;
}

export type ActivationUser = Pick<User, 'id' | 'createdAt'>;

interface ChecklistVisibilityInput {
  config: FeatureDiscoveryConfig | undefined;
  user: ActivationUser | undefined;
  progress: ActivationProgress;
  now: Date;
}

interface PushRegistrationInput {
  config: FeatureDiscoveryConfig | undefined;
  user: ActivationUser | undefined;
  progress: ActivationProgress;
}

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

function isChecklistVisible({ config, user, progress, now }: ChecklistVisibilityInput): boolean {
  if (!isNewUserCohort(config, user) || !user || progress.activatedAt) {
    return false;
  }

  const elapsed = now.getTime() - user.createdAt.getTime();
  return elapsed >= 0 && elapsed < ACTIVATION_CHECKLIST_WINDOW_MS;
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
  return Math.max(0, Math.floor((now.getTime() - user.createdAt.getTime()) / DAY_MS));
}

export const ActivationPolicy = {
  activationIdentity,
  daysSinceSignup,
  isChecklistVisible,
  isNewUserCohort,
  shouldRegisterPushAutomatically,
} as const;
