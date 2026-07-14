import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Inject, Logger } from "@nestjs/common";
import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import type { Job } from "bullmq";
import { Prisma } from "@/generated/prisma/client";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import type { SupportedLocale } from "@/shared/presentation/decorators";

import { NotificationFacade } from "../../application/facades/notification.facade";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../application/ports/notification.repository.port";
import {
	PUSH_PROVIDER,
	type PushProvider,
} from "../../application/ports/push-provider.port";
import {
	NotificationMessageBuilder,
	resolveTemplateLocale,
} from "../../domain/services/templates/notification-templates";
import {
	type BillingIssueJobData,
	type CheerSentJobData,
	type FollowMutualJobData,
	type FollowNewJobData,
	type FriendCompletedJobData,
	type MilestoneReachedJobData,
	NOTIFICATION_QUEUE,
	type NotificationJobMap,
	NotificationJobName,
	type NudgeSentJobData,
} from "./notification-queue.constants";

/**
 * job.name을 판별자로 갖는 알림 잡 (discriminated union).
 *
 * BullMQ `Job`의 name 제네릭을 잡 이름 리터럴로 고정하여, `switch (job.name)`이
 * `job.data`를 해당 잡 데이터 타입으로 자동 내로잉하도록 한다 (캐스트·가드 불필요).
 */
type NotificationJob = {
	[K in keyof NotificationJobMap]: Job<NotificationJobMap[K], unknown, K>;
}[keyof NotificationJobMap];

@Processor(NOTIFICATION_QUEUE)
export class NotificationQueueProcessor extends WorkerHost {
	readonly #logger = new Logger(NotificationQueueProcessor.name);

	constructor(
		private readonly notification: NotificationFacade,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		private readonly txHost: TransactionHost<
			TransactionalAdapterPrisma<DatabaseService>
		>,
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		@Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
	) {
		super();
	}

	@OnWorkerEvent("stalled")
	onStalled(jobId: string) {
		this.#logger.warn(`Job stalled: jobId=${jobId}`);
	}

	@OnWorkerEvent("error")
	onError(error: Error) {
		this.#logger.error(`Worker error: ${error.message}`, error.stack);
	}

	@OnWorkerEvent("failed")
	onFailed(job: Job | undefined, error: Error) {
		this.#logger.error(
			`Job failed: jobId=${job?.id}, name=${job?.name}, error=${error.message}`,
			error.stack,
		);
	}

	/** 수신자 푸시 언어 조회 — UserPreference 캐시 경유 (shouldSendPush와 캐시 공유) */
	async #getLocale(userId: string): Promise<SupportedLocale> {
		return this.notification.getUserLocale(userId);
	}

	async process(job: NotificationJob): Promise<void> {
		const jobName: string = job.name;
		switch (job.name) {
			case NotificationJobName.FOLLOW_NEW:
				await this.#handleFollowNew(job.data);
				break;
			case NotificationJobName.FOLLOW_MUTUAL:
				await this.#handleFollowMutual(job.data);
				break;
			case NotificationJobName.NUDGE_SENT:
				await this.#handleNudgeSent(job.data);
				break;
			case NotificationJobName.CHEER_SENT:
				await this.#handleCheerSent(job.data);
				break;
			case NotificationJobName.BILLING_ISSUE:
				await this.#handleBillingIssue(job.data);
				break;
			case NotificationJobName.FRIEND_COMPLETED:
				await this.#handleFriendCompleted(job.data);
				break;
			case NotificationJobName.MILESTONE_REACHED:
				await this.#handleMilestoneReached(job.data);
				break;
			case NotificationJobName.PUSH_RECEIPTS:
				await this.#handlePushReceipts();
				break;
			default: {
				// 컴파일 타임 소진 검사: 새 잡 타입 추가 시 여기서 타입 에러로 강제 처리
				const _exhaustive: never = job;
				void _exhaustive;
				this.#logger.warn(`Unknown job name: ${jobName}`);
			}
		}
	}

	async #handlePushReceipts(): Promise<void> {
		const pending =
			await this.notificationRepository.findPendingPushReceipts(900);
		if (pending.length === 0) return;
		const receipts = await this.pushProvider.getReceipts(
			pending.map((attempt) => attempt.ticketId),
		);
		const invalidTokens =
			await this.notificationRepository.recordPushReceipts(receipts);
		if (invalidTokens.length > 0) {
			await this.notificationRepository.deactivateInvalidTokens(invalidTokens);
		}
		this.#logger.log(
			`Expo receipts processed: requested=${pending.length}, received=${receipts.length}, invalidTokens=${invalidTokens.length}`,
		);
	}

	async #handleFollowNew(data: FollowNewJobData): Promise<void> {
		try {
			const locale = await this.#getLocale(data.followingId);
			const message = NotificationMessageBuilder.followNew(
				data.followerName,
				locale,
			);

			await this.notification.createAndSendWithDedup({
				userId: data.followingId,
				type: "FOLLOW_NEW",
				title: message.title,
				body: message.body,
				friendId: data.followerId,
			});

			this.#logger.log(
				`Follow request notification sent to user: ${data.followingId}`,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to send follow request notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
			throw error;
		}
	}

	async #handleFollowMutual(data: FollowMutualJobData): Promise<void> {
		try {
			const locale = await this.#getLocale(data.userId);
			const message = NotificationMessageBuilder.followAccepted(
				data.friendName,
				locale,
			);

			await this.notification.createAndSendWithDedup({
				userId: data.userId,
				type: "FOLLOW_ACCEPTED",
				title: message.title,
				body: message.body,
				friendId: data.friendId,
			});

			this.#logger.log(
				`Mutual follow notification sent to user: ${data.userId}`,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to send mutual follow notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
			throw error;
		}
	}

	async #handleNudgeSent(data: NudgeSentJobData): Promise<void> {
		try {
			const locale = await this.#getLocale(data.receiverId);
			const message = data.todoId
				? NotificationMessageBuilder.nudgeReceived(
						data.senderName,
						data.todoTitle,
						data.message,
						locale,
					)
				: NotificationMessageBuilder.remindNudgeReceived(
						data.senderName,
						data.message,
						locale,
					);

			await this.notification.createAndSendWithDedup({
				userId: data.receiverId,
				type: "NUDGE_RECEIVED",
				title: message.title,
				body: message.body,
				nudgeId: data.nudgeId,
				friendId: data.senderId,
				todoId: data.todoId,
				metadata: data.message ? { message: data.message } : undefined,
			});

			this.#logger.log(
				`Nudge notification sent: from=${data.senderId}, to=${data.receiverId}`,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to send nudge notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
			throw error;
		}
	}

	async #handleCheerSent(data: CheerSentJobData): Promise<void> {
		try {
			const locale = await this.#getLocale(data.receiverId);
			const message = NotificationMessageBuilder.cheerReceived(
				data.senderName,
				data.message,
				locale,
			);

			await this.notification.createAndSendWithDedup({
				userId: data.receiverId,
				type: "CHEER_RECEIVED",
				title: message.title,
				body: message.body,
				cheerId: data.cheerId,
				friendId: data.senderId,
				metadata: data.message ? { message: data.message } : undefined,
			});

			this.#logger.log(
				`Cheer notification sent: from=${data.senderId}, to=${data.receiverId}`,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to send cheer notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
			throw error;
		}
	}

	async #handleBillingIssue(data: BillingIssueJobData): Promise<void> {
		try {
			const locale = await this.#getLocale(data.userId);
			const message = NotificationMessageBuilder.billingIssue(locale);

			await this.notification.createAndSend({
				userId: data.userId,
				type: "SYSTEM_NOTICE",
				title: message.title,
				body: message.body,
			});

			this.#logger.log(
				`Billing issue notification sent: userId=${data.userId}`,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to send billing issue notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
			// 결제 알림은 재시도 대상 — BullMQ retry 활용
			throw error;
		}
	}

	async #handleFriendCompleted(data: FriendCompletedJobData): Promise<void> {
		if (data.notifyUserIds.length === 0) {
			this.#logger.debug("No friends to notify for friend completion");
			return;
		}

		try {
			const today = todayInTimezone(data.timezone);

			await this.uow.run(async () => {
				const alreadyNotified =
					await this.notification.findAlreadyNotifiedUserIds({
						userIds: data.notifyUserIds,
						type: "FRIEND_COMPLETED",
						notificationDate: today,
						friendId: data.friendId,
					});

				const newUserIds = data.notifyUserIds.filter(
					(id) => !alreadyNotified.has(id),
				);

				if (newUserIds.length === 0) {
					this.#logger.debug(
						`Friend completion already sent today: friendId=${data.friendId}`,
					);
					return;
				}

				// 수신자별 푸시 언어로 메시지 생성 (로케일별 1회 조립)
				const preferences = await this.txHost.tx.userPreference.findMany({
					where: { userId: { in: newUserIds } },
					select: { userId: true, locale: true },
				});
				const localeByUserId = new Map(
					preferences.map((p) => [p.userId, resolveTemplateLocale(p.locale)]),
				);
				const messageByLocale = new Map<
					SupportedLocale,
					{ title: string; body: string }
				>();

				const notifications = newUserIds.map((userId) => {
					const locale = localeByUserId.get(userId) ?? "ko";
					let message = messageByLocale.get(locale);
					if (!message) {
						message = NotificationMessageBuilder.friendCompleted(
							data.friendName,
							locale,
						);
						messageByLocale.set(locale, message);
					}
					return {
						userId,
						type: "FRIEND_COMPLETED" as const,
						title: message.title,
						body: message.body,
						friendId: data.friendId,
						notificationDate: today,
					};
				});

				await this.notification.createAndSendBatch(notifications);

				this.#logger.log(
					`Friend completion notifications sent: friendId=${data.friendId}, count=${newUserIds.length}`,
				);
			});
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				this.#logger.debug(
					`Friend completion duplicate prevented by constraint: friendId=${data.friendId}`,
				);
				return;
			}

			this.#logger.error(
				`Failed to send friend completion notifications: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
			throw error;
		}
	}

	async #handleMilestoneReached(data: MilestoneReachedJobData): Promise<void> {
		try {
			// 평생 1회 Dedup: 동일 milestone metadata 존재 시 스킵
			const existing = await this.txHost.tx.notification.findFirst({
				where: {
					userId: data.userId,
					metadata: { path: ["milestone"], equals: data.milestone },
				},
			});
			if (existing) {
				this.#logger.debug(
					`Milestone already achieved: userId=${data.userId}, milestone=${data.milestone}`,
				);
				return;
			}

			const locale = await this.#getLocale(data.userId);
			const message = NotificationMessageBuilder.milestone(
				data.milestone,
				locale,
			);

			await this.notification.createAndSend({
				userId: data.userId,
				type: "WEEKLY_ACHIEVEMENT",
				title: message.title,
				body: message.body,
				metadata: { milestone: data.milestone },
			});

			this.#logger.log(
				`Milestone notification sent: userId=${data.userId}, milestone=${data.milestone}`,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to handle milestone-reached: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
			throw error;
		}
	}
}
