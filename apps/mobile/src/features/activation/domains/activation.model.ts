import {
  featureDiscoveryConfigSchema,
  type FeatureDiscoveryConfig,
} from '@src/features/feature-discovery/domains/feature-discovery.model';
import {
  FEATURE_DISCOVERY_CAMPAIGN_ID,
  LEGACY_FEATURE_DISCOVERY_CAMPAIGN_ID,
} from '@src/features/feature-discovery/domains/feature-discovery.registry';
import type { TodoExistence } from '@src/features/todo/domains/todo.model';
import { userSchema } from '@src/features/user/domains/user.model';
import { z } from 'zod';

const DAY_MS = 24 * 60 * 60 * 1000;
// 신규 사용자 코호트는 서버 설정의 캠페인을 따른다. 소개 카드를 새 캠페인으로 바꿔도 이전 캠페인의 체크리스트가 이어진다
const ACTIVATION_CAMPAIGN_IDS: ReadonlySet<string> = new Set([
  LEGACY_FEATURE_DISCOVERY_CAMPAIGN_ID,
  FEATURE_DISCOVERY_CAMPAIGN_ID,
]);
// 1.9.0(2026-08 캠페인)부터 새 가입자의 푸시 등록을 첫 활성화 뒤로 미뤘다. 캠페인이 바뀌어도 기준은 유지한다
const PUSH_REGISTRATION_DEFERRED_SINCE = '2026-08-01T00:00:00.000Z';
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
  if (config.enabled && ACTIVATION_CAMPAIGN_IDS.has(config.campaignId)) {
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

export interface ActivationChecklistSteps {
  hasCreatedTodo: boolean;
  hasCompletedTodo: boolean;
}

/**
 * 시작 체크리스트 단계. 서버의 할 일 기록(재설치·다른 기기·웹에서 만든 할 일 포함)과
 * 이 기기에서 기록한 진행 중 하나라도 있으면 끝난 단계다. 서버 기록을 아직 못 읽었으면 기기 기록만 본다.
 */
function checklistSteps(
  progress: ActivationProgress,
  todoExistence: TodoExistence | undefined,
): ActivationChecklistSteps {
  const hasCompletedTodo =
    progress.activatedAt != null || (todoExistence?.hasCompletedTodo ?? false);
  return {
    hasCreatedTodo:
      hasCompletedTodo || progress.todoCreatedAt != null || (todoExistence?.hasTodo ?? false),
    hasCompletedTodo,
  };
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
    config == null
      ? user.createdAt.getTime() >= new Date(PUSH_REGISTRATION_DEFERRED_SINCE).getTime()
      : isNewUserCohort(config, user);
  if (!isDeferredCohort) {
    return true;
  }
  return progress.activatedAt != null || progress.pushRegistrationUnlockedAt != null;
}

function daysSinceSignup(user: ActivationUser, now: Date): number {
  return calculateElapsedDays(user.createdAt.getTime(), now.getTime());
}

export const ActivationPolicy = {
  activationIdentity,
  checklistSteps,
  daysSinceSignup,
  isChecklistVisible,
  isNewUserCohort,
  shouldRegisterPushAutomatically,
} as const;
