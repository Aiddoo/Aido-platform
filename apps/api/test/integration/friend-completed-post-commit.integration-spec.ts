import { AsyncLocalStorage } from "node:async_hooks";

import { Test, type TestingModule } from "@nestjs/testing";
import { createNotificationCacheMock } from "@test/mocks/ports/notification-cache.mock";
import { createNotificationRepositoryMock } from "@test/mocks/ports/notification.mock";

import {
	NOTIFICATION_CACHE,
	type NotificationCachePort,
} from "@/notification/application/ports/notification-cache.port";
import type { CreateNotificationData } from "@/notification/application/ports/notification-data";
import {
	NOTIFICATION_DEDUP,
	type NotificationDedupPort,
} from "@/notification/application/ports/notification-dedup.port";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "@/notification/application/ports/notification.repository.port";
import {
	PUSH_DISPATCH_STAGING,
	type PushDispatchStagingRepositoryPort,
	type StagePushDispatchInput,
} from "@/notification/application/ports/push-dispatch-staging.repository.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type UserNotificationSettingsPort,
} from "@/notification/application/ports/user-notification-settings.port";
import { NotificationHistoryReader } from "@/notification/application/readers/notification-history.reader";
import { PushDeliveryAfterCommitPublisher } from "@/notification/application/services/push-delivery-after-commit.publisher";
import { FinalizeBatchNotificationUseCase } from "@/notification/application/use-cases/finalize-batch-notification/finalize-batch-notification.use-case";
import { PersistBatchNotificationUseCase } from "@/notification/application/use-cases/persist-batch-notification/persist-batch-notification.use-case";
import {
	PublishPushDeliveryOutboxUseCase,
	type PublishPushDeliveryOutboxInput,
} from "@/notification/application/use-cases/publish-push-delivery-outbox/publish-push-delivery-outbox.use-case";
import { SendFriendCompletionNotificationsUseCase } from "@/notification/application/use-cases/send-friend-completion-notifications/send-friend-completion-notifications.use-case";
import type { NotificationRecord } from "@/notification/domain/records/notification.record";
import {
	AFTER_COMMIT_TASK_REGISTRY,
	type AfterCommitTask,
	type AfterCommitTaskRegistryPort,
	UNIT_OF_WORK,
	type UnitOfWorkPort,
} from "@/shared/application/ports";

interface TransactionContext {
	closed: boolean;
	afterCommitTasks: AfterCommitTask[];
}

/** Required 전파와 after-commit 실행 시점을 함께 관찰하는 component-test UOW. */
class AfterCommitAwareUnitOfWork implements UnitOfWorkPort, AfterCommitTaskRegistryPort {
	readonly storage = new AsyncLocalStorage<TransactionContext>();
	rootTransactionCount = 0;

	async run<T>(work: () => Promise<T>): Promise<T> {
		const active = this.storage.getStore();
		if (active && !active.closed) return work();

		this.rootTransactionCount += 1;
		const context: TransactionContext = { closed: false, afterCommitTasks: [] };
		return this.storage.run(context, async () => {
			let result: T;
			try {
				result = await work();
			} catch (error) {
				context.closed = true;
				throw error;
			}

			context.closed = true;
			for (const task of context.afterCommitTasks) await task();
			return result;
		});
	}

	register(task: AfterCommitTask): void {
		const active = this.storage.getStore();
		if (!active || active.closed) {
			throw new Error("After-commit task must be registered in an active test UOW");
		}
		active.afterCommitTasks.push(task);
	}
}

function toNotificationRecord(data: CreateNotificationData, index: number): NotificationRecord {
	return {
		id: index + 1,
		userId: data.userId,
		type: data.type,
		title: data.title,
		body: data.body,
		isRead: false,
		todoId: data.todoId ?? null,
		friendId: data.friendId ?? null,
		nudgeId: data.nudgeId ?? null,
		cheerId: data.cheerId ?? null,
		notificationDate: data.notificationDate ?? null,
		metadata: data.metadata ?? null,
		createdAt: new Date("2026-07-26T00:00:00.000Z"),
		readAt: null,
		actionType: data.action?.type ?? "DEEP_LINK",
		actionUrl: data.action?.url ?? null,
		campaignKey: data.campaignKey ?? null,
		variantId: data.variantId ?? null,
		purpose: data.purpose ?? "TRANSACTIONAL",
		openedAt: null,
	};
}

const friendCompletionInput = {
	friendId: "friend-1",
	friendName: "완료 친구",
	notifyUserIds: ["user-1", "user-2"],
	timezone: "Asia/Seoul",
};

describe("friend-completed durable post-commit publication (component)", () => {
	let module: TestingModule;
	let useCase: SendFriendCompletionNotificationsUseCase;
	let persistBatch: PersistBatchNotificationUseCase;
	let unitOfWork: AfterCommitAwareUnitOfWork;
	let repository: jest.Mocked<NotificationRepositoryPort>;
	let staging: jest.Mocked<PushDispatchStagingRepositoryPort>;
	let cache: jest.Mocked<NotificationCachePort>;
	let executePublish: jest.MockedFunction<
		(input: PublishPushDeliveryOutboxInput) => Promise<number>
	>;
	let events: string[];

	beforeEach(async () => {
		events = [];
		unitOfWork = new AfterCommitAwareUnitOfWork();
		repository = jest.mocked(createNotificationRepositoryMock());
		repository.createManyNotificationsAndReturn.mockImplementation(async (items) => {
			expect(unitOfWork.storage.getStore()?.closed).toBe(false);
			events.push("persist-notifications");
			return items.map(toNotificationRecord);
		});
		staging = jest.mocked({
			stage: jest.fn(),
			stageMany: jest.fn(async (inputs: readonly StagePushDispatchInput[]) => {
				expect(unitOfWork.storage.getStore()?.closed).toBe(false);
				events.push("stage-dispatch-outbox");
				return inputs.map((input, index) => ({
					dispatchId: 201 + index,
					notificationId: input.notificationId,
				}));
			}),
		} satisfies PushDispatchStagingRepositoryPort);
		cache = jest.mocked(createNotificationCacheMock());
		cache.invalidateUnreadCount.mockImplementation(async (userId) => {
			events.push(`invalidate-cache:${userId}`);
		});
		const notificationDedup: NotificationDedupPort = {
			recordNotifiedUsers: jest.fn(async () => {
				events.push("record-dedup");
			}),
			readKnownRecipients: jest.fn(),
			warmRecipients: jest.fn(),
		};
		const userSettings: UserNotificationSettingsPort = {
			upsertPushTimezone: jest.fn(),
			upsertPushLocale: jest.fn(),
			getPreferenceRecord: jest.fn(),
			getPreferenceRecordsByUserIds: jest.fn().mockResolvedValue([]),
			getConsentRecord: jest.fn(),
			getConsentRecordsByUserIds: jest.fn(),
			updateMarketingPushConsent: jest.fn(),
		};
		const notificationHistoryReader = {
			findAlreadyNotifiedUserIds: jest.fn().mockResolvedValue(new Set<string>()),
		};
		executePublish = jest.fn(async (input) => {
			expect(unitOfWork.storage.getStore()?.closed).toBe(true);
			events.push("publish-delivery-job");
			return input.kind === "dispatches" ? input.dispatchIds.length : 0;
		});

		module = await Test.createTestingModule({
			providers: [
				SendFriendCompletionNotificationsUseCase,
				PersistBatchNotificationUseCase,
				FinalizeBatchNotificationUseCase,
				PushDeliveryAfterCommitPublisher,
				{ provide: NotificationHistoryReader, useValue: notificationHistoryReader },
				{ provide: NOTIFICATION_REPOSITORY, useValue: repository },
				{ provide: PUSH_DISPATCH_STAGING, useValue: staging },
				{ provide: NOTIFICATION_CACHE, useValue: cache },
				{ provide: NOTIFICATION_DEDUP, useValue: notificationDedup },
				{ provide: USER_NOTIFICATION_SETTINGS, useValue: userSettings },
				{ provide: UNIT_OF_WORK, useValue: unitOfWork },
				{ provide: AFTER_COMMIT_TASK_REGISTRY, useValue: unitOfWork },
				{ provide: PublishPushDeliveryOutboxUseCase, useValue: { execute: executePublish } },
			],
		}).compile();

		useCase = module.get(SendFriendCompletionNotificationsUseCase);
		persistBatch = module.get(PersistBatchNotificationUseCase);
	});

	afterEach(async () => {
		await module?.close();
	});

	it("stages notifications and BATCH outbox atomically, then publishes only after root commit", async () => {
		await useCase.execute(friendCompletionInput);

		expect(unitOfWork.rootTransactionCount).toBe(1);
		expect(staging.stageMany).toHaveBeenCalledWith([
			expect.objectContaining({
				notificationId: 1,
				userId: "user-1",
				deliveryMode: "BATCH",
				force: false,
			}),
			expect.objectContaining({
				notificationId: 2,
				userId: "user-2",
				deliveryMode: "BATCH",
				force: false,
			}),
		]);
		expect(executePublish).toHaveBeenCalledWith({
			kind: "dispatches",
			dispatchIds: [201, 202],
		});
		expect(events).toEqual([
			"persist-notifications",
			"stage-dispatch-outbox",
			"publish-delivery-job",
			"invalidate-cache:user-1",
			"invalidate-cache:user-2",
			"record-dedup",
		]);
	});

	it("does not publish a registered delivery task when the enclosing UOW rolls back", async () => {
		const data: CreateNotificationData[] = [
			{
				userId: "user-1",
				type: "FRIEND_COMPLETED",
				title: "친구 완료",
				body: "친구가 오늘 할 일을 마쳤어요",
				friendId: "friend-1",
			},
		];

		await expect(
			unitOfWork.run(async () => {
				await persistBatch.execute(data);
				throw new Error("rollback persistence transaction");
			}),
		).rejects.toThrow("rollback persistence transaction");

		expect(unitOfWork.rootTransactionCount).toBe(1);
		expect(repository.createManyNotificationsAndReturn).toHaveBeenCalledWith(data);
		expect(staging.stageMany).toHaveBeenCalledTimes(1);
		expect(executePublish).not.toHaveBeenCalled();
	});
});
