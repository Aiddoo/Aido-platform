import type { FeatureDiscoveryConfig } from '@src/features/feature-discovery/models/feature-discovery.model';
import { FEATURE_DISCOVERY_CAMPAIGN_ID } from '@src/features/feature-discovery/models/feature-discovery.registry';
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

function isNewUserCohort(
  config: FeatureDiscoveryConfig | undefined,
  user: ActivationUser | undefined,
): boolean {
  return (
    config?.enabled === true &&
    config.campaignId === FEATURE_DISCOVERY_CAMPAIGN_ID &&
    user !== undefined &&
    user.createdAt.getTime() >= config.launchedAt.getTime()
  );
}

function activationIdentity(
  config: FeatureDiscoveryConfig | undefined,
  user: ActivationUser | undefined,
): ActivationIdentity | null {
  if (!isNewUserCohort(config, user) || !config?.enabled || !user) {
    return null;
  }
  return {
    accountId: user.id,
    campaignId: config.campaignId,
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
  if (!config || !user) {
    return false;
  }
  if (!isNewUserCohort(config, user)) {
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
