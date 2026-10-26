import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import { InviteQualifyReminderPolicy } from "../../../domain/policies/invites/invite-qualify-reminder.policy.js";
import { SocialInviteLogEvent } from "../../observability/invites/social-invite-log.events.js";
import type { InviteNotifierPort } from "../../ports/invites/invite-notifier.port.js";
import type { InviteRedemptionRepositoryPort } from "../../ports/invites/invite-redemption.repository.port.js";
import type { InviteConfigPort } from "../../ports/invites/invite.config.port.js";
import {
  isInvitePairReachable,
  type InvitePairReachabilityDependencies,
} from "../../services/invites/invite-pair-reachability.js";

export interface SendInviteQualifyReminderInput {
  readonly redemptionId: string;
  readonly now: Date;
}

export type QualifyReminderSkipReason = "disabled" | "not-due" | "quiet-hours" | "unreachable";

export type SendInviteQualifyReminderResult =
  | { readonly status: "sent" }
  | { readonly status: "skipped"; readonly reason: QualifyReminderSkipReason };

interface SendInviteQualifyReminderDependencies extends InvitePairReachabilityDependencies {
  readonly inviteRedemptionRepository: Pick<
    InviteRedemptionRepositoryPort,
    "findByIdForUpdate" | "save" | "findDisplayName"
  >;
  readonly notifier: Pick<InviteNotifierPort, "notifyQualifyReminder" | "isInQuietHours">;
  readonly inviteConfig: InviteConfigPort;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

/**
 * 예약한 시각에 자격을 다시 확인하고 수락 한 건에 한 번만 알린다. 수락 행을 잠근 채 발송 표시와 알림 기록을
 * 같은 트랜잭션에 남겨, 작업이 다시 실행되거나 할 일 완료와 겹쳐도 두 번 보내지 않고 이미 사용 시작한
 * 사람에게도 보내지 않는다. 푸시는 커밋 뒤에 나간다.
 */
export class SendInviteQualifyReminder {
  readonly #dependencies: SendInviteQualifyReminderDependencies;

  constructor(dependencies: SendInviteQualifyReminderDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendInviteQualifyReminderInput): Promise<SendInviteQualifyReminderResult> {
    const result = await this.#send(input);
    this.#dependencies.logger.log(
      result.status === "sent"
        ? { event: SocialInviteLogEvent.QUALIFY_REMINDER_SENT, redemptionId: input.redemptionId }
        : {
            event: SocialInviteLogEvent.QUALIFY_REMINDER_SKIPPED,
            redemptionId: input.redemptionId,
            reason: result.reason,
          },
    );
    return result;
  }

  async #send(input: SendInviteQualifyReminderInput): Promise<SendInviteQualifyReminderResult> {
    if (!this.#dependencies.inviteConfig.isEnabled) return skipped("disabled");

    return this.#dependencies.unitOfWork.run(async () => {
      const repository = this.#dependencies.inviteRedemptionRepository;
      const redemption = await repository.findByIdForUpdate(input.redemptionId);
      const inviterId = redemption?.inviterId;
      if (
        redemption == null ||
        inviterId == null ||
        !InviteQualifyReminderPolicy.isDue(redemption, input.now)
      ) {
        return skipped("not-due");
      }
      // 작업이 늦게 돌아 야간이면 표시하지 않고 남겨 다음 정비 작업이 다시 예약한다
      if (await this.#dependencies.notifier.isInQuietHours(redemption.inviteeId, input.now)) {
        return skipped("quiet-hours");
      }
      if (!(await isInvitePairReachable(this.#dependencies, redemption.inviteeId, inviterId))) {
        return skipped("unreachable");
      }
      const inviterName = await repository.findDisplayName(inviterId);
      if (inviterName == null) return skipped("unreachable");

      if (!redemption.markQualifyReminderSent(input.now)) return skipped("not-due");
      await repository.save(redemption);
      await this.#dependencies.notifier.notifyQualifyReminder({
        inviteeId: redemption.inviteeId,
        inviterName,
        redemptionId: redemption.id,
      });
      return { status: "sent" } as const;
    });
  }
}

function skipped(reason: QualifyReminderSkipReason): SendInviteQualifyReminderResult {
  return { status: "skipped", reason };
}
