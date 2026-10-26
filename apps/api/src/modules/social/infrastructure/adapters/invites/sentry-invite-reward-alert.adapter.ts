import { Injectable } from "@nestjs/common";
import * as Sentry from "@sentry/nestjs";

import { SENTRY_EXTRA, SENTRY_FEATURE, SENTRY_TAG } from "#api/platform/observability/sentry-keys";

import type {
  InviteRewardAlertPort,
  InviteRewardRetryExhausted,
} from "../../../application/ports/invites/invite-reward-alert.port.js";

/** 재시도를 다 쓴 초대 보상은 사람이 다시 적용해야 하므로 Sentry 이슈로 남긴다. */
@Injectable()
export class SentryInviteRewardAlertAdapter implements InviteRewardAlertPort {
  reportRetryExhausted(failure: InviteRewardRetryExhausted): void {
    Sentry.withScope((scope) => {
      scope.setTag(SENTRY_TAG.FEATURE, SENTRY_FEATURE.INVITE);
      scope.setTag(SENTRY_TAG.ERROR_CODE, failure.errorCode);
      scope.setExtra(SENTRY_EXTRA.INVITE_GRANT_ID, failure.grantId);
      scope.setExtra(SENTRY_EXTRA.INVITE_REDEMPTION_ID, failure.redemptionId);
      scope.setExtra(SENTRY_EXTRA.INVITE_REWARD_TYPE, failure.rewardType);
      scope.setExtra(SENTRY_EXTRA.INVITE_ATTEMPTS, failure.attempts);
      Sentry.captureMessage("Invite reward retries exhausted", "error");
    });
  }
}
