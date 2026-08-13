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
import { dayWindowInTimezone } from "@/shared/domain/date/utils/timezone";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { evaluateCheerCooldown } from "../../../domain/services/cheer-cooldown";
import { CheerMessage } from "../../../domain/value-objects/cheer-message.vo";
import {
	CHEER_REPOSITORY,
	type CheerRepositoryPort,
	type CheerWithRelations,
} from "../../ports/cheer.repository.port";
import {
	CHEER_LIMIT_READER,
	type CheerLimitReaderPort,
} from "../../ports/cheer-limit-reader.port";
import {
	CHEER_NOTIFIER,
	type CheerNotifierPort,
} from "../../ports/cheer-notifier.port";

export interface SendCheerInput {
	senderId: string;
	receiverId: string;
	message?: string;
}

/**
 * 응원 보내기 use-case.
 *
 * 자기 자신 체크 → 친구 관계 확인 후, 트랜잭션 안에서 일일 한도·쿨다운을 검사하고 응원을 생성한다
 * (TOCTOU 방지). 생성 후 알림을 enqueue한다.
 */
@Injectable()
export class SendCheerUseCase {
	readonly #logger = new Logger(SendCheerUseCase.name);

	constructor(
		@Inject(CHEER_REPOSITORY)
		private readonly cheerRepository: CheerRepositoryPort,
		@Inject(CHEER_NOTIFIER)
		private readonly notifier: CheerNotifierPort,
		@Inject(CHEER_LIMIT_READER)
		private readonly limitReader: CheerLimitReaderPort,
		@Inject(MUTATION_LOCK)
		private readonly mutationLock: MutationLockPort,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		private readonly followReader: FollowReader,
	) {}

	async execute(
		input: SendCheerInput,
		tz: string = "UTC",
	): Promise<CheerWithRelations> {
		const { senderId, receiverId, message } = input;

		if (senderId === receiverId) {
			throw new ApplicationException(ErrorCode.CHEER_1204);
		}

		const isFriend = await this.followReader.isMutualFriend(
			senderId,
			receiverId,
		);
		if (!isFriend) {
			throw new ApplicationException(ErrorCode.CHEER_1203, {
				targetUserId: receiverId,
			});
		}

		const cheerMessage = CheerMessage.of(message);
		const capturedAt = now();
		const quotaWindow = dayWindowInTimezone(capturedAt, tz);

		const cheer = await this.uow.run(async () => {
			await this.mutationLock.acquire([
				MutationLockKeys.cheerDaily(senderId, quotaWindow.localDate),
				MutationLockKeys.cheerCooldown(senderId, receiverId),
			]);

			const dailyLimit = await this.limitReader.getDailyLimitInTx(senderId);
			const used = await this.cheerRepository.countSentSince(
				senderId,
				quotaWindow.startsAt,
				quotaWindow.endsAt,
			);
			if (dailyLimit !== null && used >= dailyLimit) {
				throw new ApplicationException(ErrorCode.CHEER_1201, {
					limit: dailyLimit,
				});
			}

			const lastCheer = await this.cheerRepository.findLastCheerToUser(
				senderId,
				receiverId,
			);
			if (lastCheer) {
				const cooldown = evaluateCheerCooldown(lastCheer.createdAt);
				if (cooldown.isActive) {
					throw new ApplicationException(ErrorCode.CHEER_1202, {
						targetUserId: receiverId,
						remainingSeconds: cooldown.remainingSeconds,
					});
				}
			}

			return this.cheerRepository.createWithRelations({
				senderId,
				receiverId,
				message: cheerMessage.raw,
				createdAt: capturedAt,
			});
		});

		this.#logger.log(
			`Cheer sent: senderId=${senderId}, receiverId=${receiverId}`,
		);

		const senderName = cheer.sender.profile?.name ?? cheer.sender.userTag;
		this.notifier.notifyCheerSent({
			cheerId: cheer.id,
			senderId,
			receiverId,
			senderName,
			message: cheerMessage.raw,
		});

		return cheer;
	}
}
