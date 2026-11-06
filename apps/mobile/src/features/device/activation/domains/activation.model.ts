import {
  WHATS_NEW_CAMPAIGN_ID,
  LEGACY_WHATS_NEW_CAMPAIGN_ID,
  PREVIOUS_WHATS_NEW_CAMPAIGN_ID,
} from '@src/features/app-config/whats-new/constants/whats-new.constants';
import type { WhatsNewConfig } from '@src/features/app-config/whats-new/schemas/whats-new.schema';
import type { TodoExistence } from '@src/features/planning/todo/domains/todo.model';
import { DAY_MS } from '@src/shared/constants/time.constants';
import { type Instant, toEpochMs } from '@src/shared/date/instant';

import type {
  ActivationChecklistSteps,
  ActivationIdentity,
  ActivationProgress,
  ActivationUser,
} from '../schemas/activation.schema';

// 신규 사용자 코호트는 서버 설정의 캠페인을 따른다. 소개 카드를 새 캠페인으로 바꿔도 이전 캠페인의 체크리스트가 이어진다
const ACTIVATION_CAMPAIGN_IDS: ReadonlySet<string> = new Set([
  LEGACY_WHATS_NEW_CAMPAIGN_ID,
  PREVIOUS_WHATS_NEW_CAMPAIGN_ID,
  WHATS_NEW_CAMPAIGN_ID,
]);
// 1.9.0(2026-08 캠페인)부터 새 가입자의 푸시 등록을 첫 활성화 뒤로 미뤘다. 캠페인이 바뀌어도 기준은 유지한다
const PUSH_REGISTRATION_DEFERRED_SINCE = '2026-08-01T00:00:00.000Z';
export const ACTIVATION_CHECKLIST_WINDOW_MS = 7 * DAY_MS;

interface PushRegistrationInput {
  config: WhatsNewConfig | undefined;
  user: ActivationUser | undefined;
  progress: ActivationProgress;
}
interface ChecklistEligibilityInput extends PushRegistrationInput {
  now: Instant;
}
// 친구 초대는 선택 단계라 노출 판단에 넣지 않는다. 필수 단계(만들기·완료)만 본다
interface ChecklistVisibilityInput extends ChecklistEligibilityInput {
  steps: ActivationChecklistSteps;
}

function resolveEnabledCampaign(
  config: WhatsNewConfig,
): { campaignId: string; launchedAt: Instant } | null {
  if (config.enabled && ACTIVATION_CAMPAIGN_IDS.has(config.campaignId)) {
    return {
      campaignId: config.campaignId,
      launchedAt: config.launchedAt,
    };
  }
  return null;
}

function isNewUserCohort(
  config: WhatsNewConfig | undefined,
  user: ActivationUser | undefined,
): boolean {
  const campaign = config ? resolveEnabledCampaign(config) : null;
  return Boolean(campaign && user && user.createdAt.getTime() >= toEpochMs(campaign.launchedAt));
}

function getActivationIdentity(
  config: WhatsNewConfig | undefined,
  user: ActivationUser | undefined,
): ActivationIdentity | null {
  const campaign = config ? resolveEnabledCampaign(config) : null;
  if (!campaign || !user || user.createdAt.getTime() < toEpochMs(campaign.launchedAt)) {
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

/** 체크리스트 대상인지. 신규 코호트이고 활성화 전이며 가입 후 7일 안이어야 한다 */
function isChecklistEligible({ config, user, progress, now }: ChecklistEligibilityInput): boolean {
  if (!isNewUserCohort(config, user) || !user || progress.activatedAt) {
    return false;
  }

  return isWithinTimeWindow(
    user.createdAt.getTime(),
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

/** 대상이고 필수 단계를 아직 다 끝내지 않았을 때만 보인다. 선택 단계(친구 초대)는 카드를 붙잡아 두지 않는다 */
function isChecklistVisible({ steps, ...input }: ChecklistVisibilityInput): boolean {
  return isChecklistEligible(input) && !(steps.hasCreatedTodo && steps.hasCompletedTodo);
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

function getDaysSinceSignup(user: ActivationUser, now: Instant): number {
  return calculateElapsedDays(user.createdAt.getTime(), toEpochMs(now));
}

export const ActivationPolicy = {
  getActivationIdentity,
  getChecklistSteps,
  getDaysSinceSignup,
  isChecklistEligible,
  isChecklistVisible,
  isNewUserCohort,
  shouldRegisterPushAutomatically,
} as const;
