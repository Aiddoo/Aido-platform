import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { InviteRedemptionId } from "../../domain/invite-redemption-id.vo.js";
import { InviteLogEvent } from "../invites.log-events.js";
import type { InviteConfigPort } from "../ports/invite-config.port.js";
import type { InviteNotifierPort } from "../ports/invite-notifier.port.js";
import type { InviteRedemptionRepositoryPort } from "../ports/invite-redemption.repository.port.js";
import type { InviteUserReaderPort } from "../ports/invite-user.reader.port.js";
import type { CheckInvitePairReachabilityUseCase } from "./check-invite-pair-reachability.use-case.js";

export interface SendInviteQualifyReminderCommand {
  readonly redemptionId: string;
  readonly now: Temporal.Instant;
}

type QualifyReminderSkipReason = "disabled" | "not-due" | "quiet-hours" | "unreachable";

export type SendInviteQualifyReminderResult =
  | { readonly status: "sent" }
  | { readonly status: "skipped"; readonly reason: QualifyReminderSkipReason };

export interface SendInviteQualifyReminderDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly inviteRedemptionRepository: Pick<
    InviteRedemptionRepositoryPort,
    "findByIdForUpdate" | "save"
  >;
  readonly userReader: Pick<InviteUserReaderPort, "findDisplayName">;
  readonly pairReachability: Pick<CheckInvitePairReachabilityUseCase, "execute">;
  readonly notifier: Pick<InviteNotifierPort, "notifyQualifyReminder" | "isInQuietHours">;
  readonly inviteConfig: Pick<InviteConfigPort, "isEnabled">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

function skipped(reason: QualifyReminderSkipReason): SendInviteQualifyReminderResult {
  return { status: "skipped", reason };
}

/**
 * 예약한 시각에 자격을 다시 확인하고 수락 한 건에 한 번만 알린다. 수락 행을 잠근 채 발송 표시와 알림 기록을
 * 같은 트랜잭션에 남겨, 작업이 다시 실행되거나 할 일 완료와 겹쳐도 두 번 보내지 않고 이미 사용 시작한
 * 사람에게도 보내지 않는다. 푸시는 커밋 뒤에 나간다.
 */
export class SendInviteQualifyReminderUseCase {
  readonly #dependencies: SendInviteQualifyReminderDependencies;

  constructor(dependencies: SendInviteQualifyReminderDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(
    command: SendInviteQualifyReminderCommand,
  ): Promise<SendInviteQualifyReminderResult> {
    const result = await this.#send(command);
    this.#dependencies.logger.log(
      result.status === "sent"
        ? { event: InviteLogEvent.QUALIFY_REMINDER_SENT, redemptionId: command.redemptionId }
        : {
            event: InviteLogEvent.QUALIFY_REMINDER_SKIPPED,
            redemptionId: command.redemptionId,
            reason: result.reason,
          },
    );
    return result;
  }

  async #send(command: SendInviteQualifyReminderCommand): Promise<SendInviteQualifyReminderResult> {
    const {
      unitOfWork,
      inviteRedemptionRepository,
      userReader,
      pairReachability,
      notifier,
      inviteConfig,
    } = this.#dependencies;
    if (!inviteConfig.isEnabled) {
      return skipped("disabled");
    }

    return unitOfWork.run(async () => {
      const redemption = await inviteRedemptionRepository.findByIdForUpdate(
        InviteRedemptionId.reconstitute(command.redemptionId),
      );
      const inviterId = redemption?.inviterId;
      if (
        redemption == null ||
        inviterId == null ||
        !redemption.isQualifyReminderDue(command.now)
      ) {
        return skipped("not-due");
      }
      // 작업이 늦게 돌아 야간이면 표시하지 않고 남겨 다음 정비 작업이 다시 예약한다
      if (await notifier.isInQuietHours(redemption.inviteeId, command.now)) {
        return skipped("quiet-hours");
      }
      if (!(await pairReachability.execute({ inviteeId: redemption.inviteeId, inviterId }))) {
        return skipped("unreachable");
      }
      const inviterName = await userReader.findDisplayName(inviterId);
      if (inviterName == null) {
        return skipped("unreachable");
      }

      if (!redemption.markQualifyReminderSent(command.now)) {
        return skipped("not-due");
      }
      await inviteRedemptionRepository.save(redemption);
      await notifier.notifyQualifyReminder({
        inviteeId: redemption.inviteeId.value,
        inviterName,
        redemptionId: redemption.id.value,
      });
      return { status: "sent" };
    });
  }
}
