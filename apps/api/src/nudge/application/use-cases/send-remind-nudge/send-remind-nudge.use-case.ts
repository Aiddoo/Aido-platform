import { ErrorCode } from "@aido/errors";
import { Inject, Injectable, Logger } from "@nestjs/common";

import { FollowReader } from "@/follow";
import {
	MUTATION_LOCK,
	MutationLockKeys,
	type MutationLockPort,
	UNIT_OF_WORK,
	type UnitOfWorkPort,
} from "@/shared/application/ports";
import { now } from "@/shared/domain/date/utils/core";
import { startOfDayInTimezone } from "@/shared/domain/date/utils/timezone";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { evaluateRemindNudgeCooldown } from "../../../domain/services/nudge-cooldown";
import { NudgeMessage } from "../../../domain/value-objects/nudge-message.vo";
import { NUDGE_NOTIFIER, type NudgeNotifierPort } from "../../ports/nudge-notifier.port";
import {
	NUDGE_REPOSITORY,
	type NudgeRepositoryPort,
	type ReminderNudgeWithRelations,
} from "../../ports/nudge.repository.port";

export interface SendRemindNudgeInput {
	senderId: string;
	receiverId: string;
	message?: string;
}

/**
 * 리마인드 콕 찌르기 보내기 use-case.
 *
 * 친구가 오늘 할 일을 만들지 않았을 때 독촉한다. 자기 자신 체크 → 친구 관계 확인 후,
 * 트랜잭션 안에서 수신자의 오늘 할 일 부재·쿨다운(동일 친구 1시간, 일일 제한 없음)을 검사하고
 * 생성한다. 생성 후 알림을 enqueue한다(특정 할 일에 묶이지 않으므로 todoId·todoTitle 없이).
 */
@Injectable()
export class SendRemindNudgeUseCase {
	readonly #logger = new Logger(SendRemindNudgeUseCase.name);

	constructor(
		@Inject(NUDGE_REPOSITORY)
		private readonly nudgeRepository: NudgeRepositoryPort,
		@Inject(NUDGE_NOTIFIER)
		private readonly notifier: NudgeNotifierPort,
		@Inject(MUTATION_LOCK)
		private readonly mutationLock: MutationLockPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		private readonly followReader: FollowReader,
	) {}

	async execute(
		input: SendRemindNudgeInput,
		tz: string = "UTC",
	): Promise<ReminderNudgeWithRelations> {
		const { senderId, receiverId, message } = input;

		if (senderId === receiverId) {
			throw new ApplicationException(ErrorCode.NUDGE_1104);
		}

		const isFriend = await this.followReader.isMutualFriend(senderId, receiverId);
		if (!isFriend) {
			throw new ApplicationException(ErrorCode.NUDGE_1103, {
				targetUserId: receiverId,
			});
		}

		const nudgeMessage = NudgeMessage.of(message);
		const capturedAt = now();
		const today = startOfDayInTimezone(capturedAt, tz);

		const remindNudge = await this.uow.run(async () => {
			await this.mutationLock.acquire([MutationLockKeys.remindNudgeCooldown(senderId, receiverId)]);

			const todayTodoCount = await this.nudgeRepository.countTodayTodos(receiverId, today);
			if (todayTodoCount > 0) {
				throw new ApplicationException(ErrorCode.NUDGE_1107, { receiverId });
			}

			const lastRemind = await this.nudgeRepository.findLastRemindNudge(senderId, receiverId);
			if (lastRemind) {
				const cooldown = evaluateRemindNudgeCooldown(lastRemind.createdAt);
				if (cooldown.isActive) {
					throw new ApplicationException(ErrorCode.NUDGE_1108, {
						targetUserId: receiverId,
						remainingSeconds: cooldown.remainingSeconds,
					});
				}
			}

			return this.nudgeRepository.createRemindNudge({
				senderId,
				receiverId,
				message: nudgeMessage.raw,
			});
		});

		this.#logger.log(`Remind nudge sent: senderId=${senderId}, receiverId=${receiverId}`);

		const senderName = remindNudge.sender.profile?.name ?? remindNudge.sender.userTag;
		this.notifier.notifyNudgeSent({
			nudgeId: remindNudge.id,
			senderId,
			receiverId,
			senderName,
			message: nudgeMessage.raw,
		});

		return remindNudge;
	}
}
