import {
  WHATS_NEW_CAMPAIGN_ID,
  LEGACY_WHATS_NEW_CAMPAIGN_ID,
  PREVIOUS_WHATS_NEW_CAMPAIGN_ID,
} from '@src/features/app-config/feature-campaign/constants/feature-campaign.constants';
import type { FeatureCampaignConfig } from '@src/features/app-config/feature-campaign/domains/feature-campaign.model';
import type { TodoExistence } from '@src/features/planning/todo/domains/todo.model';
import { DAY_MS } from '@src/shared/constants/time-units';
import { type Instant, instantSchema, toEpochMs, toInstant } from '@src/shared/date/instant';
import { z } from 'zod';

export const activationProgressSchema = z.object({
  todoCreatedAt: instantSchema.nullable(),
  activatedAt: instantSchema.nullable(),
  pushRegistrationUnlockedAt: instantSchema.nullable(),
});
export type ActivationProgress = z.infer<typeof activationProgressSchema>;

const activationIdentitySchema = z.object({ accountId: z.string(), campaignId: z.string() });
export type ActivationIdentity = z.infer<typeof activationIdentitySchema>;

const activationUserSchema = z.object({ id: z.string(), createdAt: instantSchema });
export type ActivationUser = z.infer<typeof activationUserSchema>;

const activationChecklistStepsSchema = z.object({
  hasCreatedTodo: z.boolean(),
  hasCompletedTodo: z.boolean(),
});
export type ActivationChecklistSteps = z.infer<typeof activationChecklistStepsSchema>;

// 신규 사용자 코호트는 서버 설정의 캠페인을 따른다. 소개 카드를 새 캠페인으로 바꿔도 이전 캠페인의 체크리스트가 이어진다
const ACTIVATION_CAMPAIGN_IDS: ReadonlySet<string> = new Set([
  LEGACY_WHATS_NEW_CAMPAIGN_ID,
  PREVIOUS_WHATS_NEW_CAMPAIGN_ID,
  WHATS_NEW_CAMPAIGN_ID,
]);
// 1.9.0(2026-08 캠페인)부터 새 가입자의 푸시 등록을 첫 활성화 뒤로 미뤘다. 캠페인이 바뀌어도 기준은 유지한다
const PUSH_REGISTRATION_DEFERRED_SINCE = toInstant('2026-08-01T00:00:00.000Z');
const ACTIVATION_CHECKLIST_WINDOW_MS = 7 * DAY_MS;

interface PushRegistrationInput {
  config: FeatureCampaignConfig | undefined;
  user: ActivationUser | undefined;
  progress: ActivationProgress;
}
interface ChecklistEligibilityInput extends PushRegistrationInput {
  now: Instant;
}

function findEnabledCampaign(
  config: FeatureCampaignConfig,
): { campaignId: string; launchedAt: Instant } | null {
  if (config.enabled && ACTIVATION_CAMPAIGN_IDS.has(config.campaignId)) {
    return {
      campaignId: config.campaignId,
      launchedAt: config.launchedAt,
    };
  }
  return null;
}

function findActivationIdentity(
  config: FeatureCampaignConfig | undefined,
  user: ActivationUser | undefined,
): ActivationIdentity | null {
  const campaign = config ? findEnabledCampaign(config) : null;
  if (!campaign || !user || toEpochMs(user.createdAt) < toEpochMs(campaign.launchedAt)) {
    return null;
  }
  return {
    accountId: user.id,
    campaignId: campaign.campaignId,
  };
}

function isNewUserCohort(
  config: FeatureCampaignConfig | undefined,
  user: ActivationUser | undefined,
): boolean {
  return findActivationIdentity(config, user) != null;
}

function isWithinTimeWindow(createdAt: number, now: number, window: number): boolean {
  const elapsed = now - createdAt;
  return 0 <= elapsed && elapsed < window;
}

function calculateElapsedDays(createdAt: number, now: number): number {
  return Math.max(0, Math.floor((now - createdAt) / DAY_MS));
}

/** 체크리스트 대상인지. 신규 코호트이고 활성화 전이며 가입 후 7일 안이어야 한다 */
function shouldOfferChecklist({ config, user, progress, now }: ChecklistEligibilityInput): boolean {
  if (!isNewUserCohort(config, user) || !user || progress.activatedAt) {
    return false;
  }

  return isWithinTimeWindow(
    toEpochMs(user.createdAt),
    toEpochMs(now),
    ACTIVATION_CHECKLIST_WINDOW_MS,
  );
}

/**
 * 시작 체크리스트 단계. 서버의 할 일 기록(재설치·다른 기기·웹에서 만든 할 일 포함)과
 * 이 기기에서 기록한 진행 중 하나라도 있으면 끝난 단계다. 서버 기록을 아직 못 읽었으면 기기 기록만 본다.
 */
function getChecklistSteps(
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

/** 필수 단계(만들기·완료)만 본다. 친구 초대는 선택 단계라 끝내지 않아도 된다 */
function hasFinishedRequiredSteps(steps: ActivationChecklistSteps): boolean {
  return steps.hasCreatedTodo && steps.hasCompletedTodo;
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
      ? toEpochMs(user.createdAt) >= toEpochMs(PUSH_REGISTRATION_DEFERRED_SINCE)
      : isNewUserCohort(config, user);
  if (!isDeferredCohort) {
    return true;
  }
  return progress.activatedAt != null || progress.pushRegistrationUnlockedAt != null;
}

function getDaysSinceSignup(user: ActivationUser, now: Instant): number {
  return calculateElapsedDays(toEpochMs(user.createdAt), toEpochMs(now));
}

const UNKNOWN_ACCOUNT_KEY = 'compatibility-fallback';
const NO_UNLOCK_MOMENT_KEY = 'existing';

function getPushAskKey(
  progress: Pick<ActivationProgress, 'activatedAt' | 'pushRegistrationUnlockedAt'>,
  user: Pick<ActivationUser, 'id'> | undefined,
): string {
  const unlockedAt = progress.activatedAt ?? progress.pushRegistrationUnlockedAt;
  return `${user?.id ?? UNKNOWN_ACCOUNT_KEY}:${unlockedAt ?? NO_UNLOCK_MOMENT_KEY}`;
}

export const ActivationPolicy = {
  getPushAskKey,
  findActivationIdentity,
  getChecklistSteps,
  getDaysSinceSignup,
  shouldOfferChecklist,
  hasFinishedRequiredSteps,
  shouldRegisterPushAutomatically,
} as const;
