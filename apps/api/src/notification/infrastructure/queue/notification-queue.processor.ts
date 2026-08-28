import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import { Prisma } from "@/generated/prisma/client";
import {
	JOB_RUNTIME,
	type JobData,
	type JobRuntimePort,
	UNIT_OF_WORK,
	type UnitOfWorkPort,
} from "@/shared/application/ports";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import { DEFAULT_LOCALE, type SupportedLocale, toSupportedLocale } from "@/shared/domain/locale";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";
import { fromLegacyJob, type NamedJob } from "@/shared/infrastructure/jobs/named-job";

import { NotificationBatchDispatcher } from "../../application/dispatchers/notification-batch.dispatcher";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../application/ports/notification.repository.port";
import { PUSH_PROVIDER, type PushProvider } from "../../application/ports/push-provider.port";
import { NotificationSender } from "../../application/senders/notification.sender";
import {
	createBillingIssueNotificationMessage,
	createCheerReceivedNotificationMessage,
	createFollowAcceptedNotificationMessage,
	createFollowRequestNotificationMessage,
	createFriendCompletedNotificationMessage,
	createNudgeReceivedNotificationMessage,
	createTodoCreationNudgeNotificationMessage,
	createMilestoneNotificationMessage,
} from "../../domain/services/templates/notification-templates";
import { TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY } from "../../domain/services/transactional-notification-campaign";
import {
	type BillingIssueJobData,
	type CheerSentJobData,
	type FollowMutualJobData,
	type FollowNewJobData,
	type FriendCompletedJobData,
	type MilestoneReachedJobData,
	NOTIFICATION_LEGACY_QUEUE,
	NOTIFICATION_QUEUE,
	NOTIFICATION_WORKER_POLICY,
	type NotificationJobMap,
	NotificationJobName,
	NotificationRuntimeJobSchema,
	type NudgeSentJobData,
} from "./notification-queue.constants";

/**
 * job.name을 판별자로 갖는 알림 잡 (discriminated union).
 *
 * name 리터럴을 유지하여 `switch (job.name)`이 `job.data`를 해당 잡 데이터
 * 타입으로 자동 내로잉하도록 한다 (캐스트·가드 불필요).
 */
type NotificationJob = NamedJob<NotificationJobMap>;

@Injectable()
export class NotificationQueueProcessor implements OnModuleInit {
	readonly #logger = new Logger(NotificationQueueProcessor.name);

	constructor(
		private readonly notification: NotificationSender,
		private readonly batchDispatcher: NotificationBatchDispatcher,
		@Inject(UNIT_OF_WORK)
		private readonly uow: UnitOfWorkPort,
		private readonly txHost: TransactionHost<TransactionalAdapterPrisma<DatabaseService>>,
		@Inject(NOTIFICATION_REPOSITORY)
		private readonly notificationRepository: NotificationRepositoryPort,
		@Inject(PUSH_PROVIDER) private readonly pushProvider: PushProvider,
		@Optional()
		@Inject(JOB_RUNTIME)
		private readonly runtime?: JobRuntimePort,
	) {}

	onStalled(jobId: string) {
		this.#logger.warn(`Job stalled: jobId=${jobId}`);
	}

	onError(error: Error) {
		this.#logger.error(`Worker error: ${error.message}`, error.stack);
	}

	onFailed(job: { readonly id?: string; readonly name?: string } | undefined, error: Error) {
		this.#logger.error(
			`Job failed: jobId=${job?.id}, name=${job?.name}, error=${error.message}`,
			error.stack,
		);
	}

	async onModuleInit(): Promise<void> {
		if (!this.runtime) return;
		await this.runtime.work<NotificationJob>(
			NOTIFICATION_QUEUE,
			async (jobs) => {
				for (const job of jobs) await this.process(job.data);
			},
			NOTIFICATION_WORKER_POLICY,
		);
		await this.runtime.work<JobData>(
			NOTIFICATION_LEGACY_QUEUE,
			async (jobs) => {
				for (const job of jobs) {
					await this.process(fromLegacyJob<NotificationJobMap>(job));
				}
			},
			NOTIFICATION_WORKER_POLICY,
		);
	}

	/** 수신자 푸시 언어 조회 — UserPreference 캐시 경유 (shouldSendPush와 캐시 공유) */
	async #getLocale(userId: string): Promise<SupportedLocale> {
		return this.notification.getUserLocale(userId);
	}

	async process(untrustedJob: NotificationJob): Promise<void> {
		const job = NotificationRuntimeJobSchema.parse(untrustedJob);
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
		const pending = await this.notificationRepository.findPendingPushReceipts(900);
		if (pending.length === 0) return;
		const receipts = await this.pushProvider.getReceipts(
			pending.map((attempt) => attempt.ticketId),
		);
		const invalidTokens = await this.notificationRepository.recordPushReceipts(receipts);
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
			const variantContext = {
				campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FOLLOW_REQUEST,
				recipientId: data.followingId,
				occurrenceKey: `${data.followerId}:${data.followingId}`,
			};
			const message = createFollowRequestNotificationMessage({
				senderName: data.followerName,
				locale,
				variantContext,
			});

			await this.notification.createAndSendWithDedup({
				userId: data.followingId,
				type: "FOLLOW_NEW",
				title: message.title,
				body: message.body,
				friendId: data.followerId,
				campaignKey: variantContext.campaignKey,
				variantId: message.variantId,
			});

			this.#logger.log(`Follow request notification sent to user: ${data.followingId}`);
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
			const variantContext = {
				campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FOLLOW_ACCEPTED,
				recipientId: data.userId,
				occurrenceKey: `${data.friendId}:${data.userId}`,
			};
			const message = createFollowAcceptedNotificationMessage({
				senderName: data.friendName,
				locale,
				variantContext,
			});

			await this.notification.createAndSendWithDedup({
				userId: data.userId,
				type: "FOLLOW_ACCEPTED",
				title: message.title,
				body: message.body,
				friendId: data.friendId,
				campaignKey: variantContext.campaignKey,
				variantId: message.variantId,
			});

			this.#logger.log(`Mutual follow notification sent to user: ${data.userId}`);
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
			const variantContext = {
				campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.NUDGE_RECEIVED,
				recipientId: data.receiverId,
				occurrenceKey: String(data.nudgeId),
			};
			const message = data.todoId
				? createNudgeReceivedNotificationMessage({
						senderName: data.senderName,
						todoTitle: data.todoTitle,
						message: data.message,
						locale,
						variantContext,
					})
				: createTodoCreationNudgeNotificationMessage({
						senderName: data.senderName,
						message: data.message,
						locale,
						variantContext,
					});

			await this.notification.createAndSendWithDedup({
				userId: data.receiverId,
				type: "NUDGE_RECEIVED",
				title: message.title,
				body: message.body,
				nudgeId: data.nudgeId,
				friendId: data.senderId,
				todoId: data.todoId,
				metadata: data.message ? { message: data.message } : undefined,
				campaignKey: variantContext.campaignKey,
				variantId: message.variantId,
			});

			this.#logger.log(`Nudge notification sent: from=${data.senderId}, to=${data.receiverId}`);
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
			const variantContext = {
				campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.CHEER_RECEIVED,
				recipientId: data.receiverId,
				occurrenceKey: String(data.cheerId),
			};
			const message = createCheerReceivedNotificationMessage({
				senderName: data.senderName,
				message: data.message,
				locale,
				variantContext,
			});

			await this.notification.createAndSendWithDedup({
				userId: data.receiverId,
				type: "CHEER_RECEIVED",
				title: message.title,
				body: message.body,
				cheerId: data.cheerId,
				friendId: data.senderId,
				metadata: data.message ? { message: data.message } : undefined,
				campaignKey: variantContext.campaignKey,
				variantId: message.variantId,
			});

			this.#logger.log(`Cheer notification sent: from=${data.senderId}, to=${data.receiverId}`);
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
			const message = createBillingIssueNotificationMessage({ locale });

			await this.notification.createAndSend({
				userId: data.userId,
				type: "SYSTEM_NOTICE",
				title: message.title,
				body: message.body,
			});

			this.#logger.log(`Billing issue notification sent: userId=${data.userId}`);
		} catch (error) {
			this.#logger.error(
				`Failed to send billing issue notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
			// 결제 알림은 큐 런타임의 재시도 정책을 따른다.
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
			const localDate = today.toISOString().slice(0, 10);

			const persisted = await this.uow.run(async () => {
				const alreadyNotified = await this.notification.findAlreadyNotifiedUserIds({
					userIds: data.notifyUserIds,
					type: "FRIEND_COMPLETED",
					notificationDate: today,
					friendId: data.friendId,
				});

				const newUserIds = data.notifyUserIds.filter((id) => !alreadyNotified.has(id));

				if (newUserIds.length === 0) {
					this.#logger.debug(`Friend completion already sent today: friendId=${data.friendId}`);
					return null;
				}

				// 수신자의 언어와 이벤트 ID를 함께 사용해 재시도에도 같은 카피를 고른다.
				const preferences = await this.txHost.tx.userPreference.findMany({
					where: { userId: { in: newUserIds } },
					select: { userId: true, locale: true },
				});
				const localeByUserId = new Map(
					preferences.map((p) => [p.userId, toSupportedLocale(p.locale)]),
				);
				const notifications = newUserIds.map((userId) => {
					const locale = localeByUserId.get(userId) ?? DEFAULT_LOCALE;
					const variantContext = {
						campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.FRIEND_COMPLETED,
						recipientId: userId,
						occurrenceKey: `${data.friendId}:${localDate}`,
					};
					const message = createFriendCompletedNotificationMessage({
						friendName: data.friendName,
						locale,
						variantContext,
					});
					return {
						userId,
						type: "FRIEND_COMPLETED" as const,
						title: message.title,
						body: message.body,
						friendId: data.friendId,
						notificationDate: today,
						campaignKey: variantContext.campaignKey,
						variantId: message.variantId,
					};
				});

				return this.batchDispatcher.persistBatch(notifications);
			});
			if (!persisted) return;

			this.#logger.log(
				`Friend completion notifications persisted: friendId=${data.friendId}, count=${persisted.count}`,
			);
			this.batchDispatcher.dispatchPersistedBatch(persisted);
			this.#logger.debug(
				`Friend completion push delivery scheduled: friendId=${data.friendId}, count=${persisted.count}`,
			);
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
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
			const message = createMilestoneNotificationMessage({
				milestone: data.milestone,
				locale,
			});

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
