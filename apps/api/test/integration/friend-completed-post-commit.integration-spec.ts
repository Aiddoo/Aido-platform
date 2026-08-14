import { AsyncLocalStorage } from "node:async_hooks";
import { Test, type TestingModule } from "@nestjs/testing";
import { TransactionHost } from "@nestjs-cls/transactional";
import {
	createNotificationRepositoryMock,
	createPushDispatcherMock,
} from "@test/mocks/ports/notification.mock";
import {
	NOTIFICATION_REPOSITORY,
	NotificationSender,
	PUSH_PROVIDER,
} from "@/notification";
import { NotificationBatchDispatcher } from "@/notification/application/dispatchers/notification-batch.dispatcher";
import { NOTIFICATION_CACHE } from "@/notification/application/ports/notification-cache.port";
import type { CreateNotificationData } from "@/notification/application/ports/notification-data";
import { NOTIFICATION_DEDUP } from "@/notification/application/ports/notification-dedup.port";
import {
	PUSH_DISPATCHER,
	type PushDispatcherPort,
} from "@/notification/application/ports/push-dispatcher.port";
import { DispatchBatchNotificationUseCase } from "@/notification/application/use-cases/dispatch-batch-notification/dispatch-batch-notification.use-case";
import { FindAlreadyNotifiedUsersUseCase } from "@/notification/application/use-cases/find-already-notified-users/find-already-notified-users.use-case";
import { GetNotificationsUseCase } from "@/notification/application/use-cases/get-notifications/get-notifications.use-case";
import { GetUnreadCountUseCase } from "@/notification/application/use-cases/get-unread-count/get-unread-count.use-case";
import { MarkAllAsReadUseCase } from "@/notification/application/use-cases/mark-all-as-read/mark-all-as-read.use-case";
import { MarkAsReadUseCase } from "@/notification/application/use-cases/mark-as-read/mark-as-read.use-case";
import { MarkNotificationOpenedUseCase } from "@/notification/application/use-cases/mark-notification-opened/mark-notification-opened.use-case";
import { OptOutMarketingPushUseCase } from "@/notification/application/use-cases/opt-out-marketing-push/opt-out-marketing-push.use-case";
import { PersistBatchNotificationUseCase } from "@/notification/application/use-cases/persist-batch-notification/persist-batch-notification.use-case";
import { RegisterPushTokenUseCase } from "@/notification/application/use-cases/register-push-token/register-push-token.use-case";
import { SendBatchNotificationUseCase } from "@/notification/application/use-cases/send-batch-notification/send-batch-notification.use-case";
import { SendNotificationUseCase } from "@/notification/application/use-cases/send-notification/send-notification.use-case";
import { SendNotificationWithDedupUseCase } from "@/notification/application/use-cases/send-notification-with-dedup/send-notification-with-dedup.use-case";
import { UnregisterPushTokenUseCase } from "@/notification/application/use-cases/unregister-push-token/unregister-push-token.use-case";
import {
	type NotificationJobMap,
	NotificationJobName,
} from "@/notification/infrastructure/queue/notification-queue.constants";
import { NotificationQueueProcessor } from "@/notification/infrastructure/queue/notification-queue.processor";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import type { NamedJob } from "@/shared/infrastructure/jobs/named-job";

interface TransactionContext {
	closed: boolean;
}

class ContextAwareUnitOfWork implements UnitOfWorkPort {
	readonly storage = new AsyncLocalStorage<TransactionContext>();

	async run<T>(work: () => Promise<T>): Promise<T> {
		const context = { closed: false };
		return this.storage.run(context, async () => {
			try {
				return await work();
			} finally {
				context.closed = true;
			}
		});
	}
}

class ClosedTransactionDetectingDispatcher implements PushDispatcherPort {
	readonly #pending = new Set<Promise<void>>();
	scheduledBatchCount = 0;

	constructor(
		private readonly storage: AsyncLocalStorage<TransactionContext>,
		private readonly delegate: PushDispatcherPort,
	) {}

	shouldSendPush(
		...args: Parameters<PushDispatcherPort["shouldSendPush"]>
	): ReturnType<PushDispatcherPort["shouldSendPush"]> {
		return this.delegate.shouldSendPush(...args);
	}

	getUserLocale(
		...args: Parameters<PushDispatcherPort["getUserLocale"]>
	): ReturnType<PushDispatcherPort["getUserLocale"]> {
		return this.delegate.getUserLocale(...args);
	}

	fireAndForgetPush(
		...args: Parameters<PushDispatcherPort["fireAndForgetPush"]>
	): ReturnType<PushDispatcherPort["fireAndForgetPush"]> {
		return this.delegate.fireAndForgetPush(...args);
	}

	fireAndForgetBatchPush(): void {
		this.scheduledBatchCount += 1;
		const delivery = new Promise<void>((resolve, reject) => {
			setImmediate(() => {
				if (this.storage.getStore()?.closed) {
					reject(new Error("Transaction already closed"));
					return;
				}
				resolve();
			});
		});
		this.#pending.add(delivery);
		void delivery.then(
			() => this.#pending.delete(delivery),
			() => this.#pending.delete(delivery),
		);
	}

	async drain(): Promise<void> {
		await Promise.all([...this.#pending]);
	}
}

const unusedUseCase = { execute: jest.fn() };

describe("friend-completed post-commit dispatch (component)", () => {
	let module: TestingModule;
	let processor: NotificationQueueProcessor;
	let dispatcher: ClosedTransactionDetectingDispatcher;

	beforeEach(async () => {
		const uow = new ContextAwareUnitOfWork();
		const repository = createNotificationRepositoryMock();
		repository.findAlreadyNotifiedUserIds = jest
			.fn()
			.mockResolvedValue(new Set());
		repository.createManyNotificationsAndReturn = jest
			.fn()
			.mockImplementation(async (items: CreateNotificationData[]) =>
				items.map((item, index) => ({
					id: index + 1,
					userId: item.userId,
					type: item.type,
					title: item.title,
					body: item.body,
					isRead: false,
					todoId: item.todoId ?? null,
					friendId: item.friendId ?? null,
					nudgeId: item.nudgeId ?? null,
					cheerId: item.cheerId ?? null,
					notificationDate: item.notificationDate ?? null,
					metadata: item.metadata ?? null,
					createdAt: new Date("2026-07-26T00:00:00.000Z"),
					readAt: null,
					actionType: item.action?.type ?? "DEEP_LINK",
					actionUrl: item.action?.url ?? null,
					campaignKey: item.campaignKey ?? null,
					variantId: item.variantId ?? null,
					purpose: item.purpose ?? "TRANSACTIONAL",
					openedAt: null,
				})),
			);

		const pushDelegate = createPushDispatcherMock();
		pushDelegate.getUserLocale = jest.fn().mockResolvedValue("ko");
		dispatcher = new ClosedTransactionDetectingDispatcher(
			uow.storage,
			pushDelegate,
		);

		const dedupProvider: IDedupProvider = {
			filterMembers: jest.fn().mockResolvedValue(new Set()),
			isMember: jest.fn().mockResolvedValue(false),
			addMembers: jest.fn().mockResolvedValue(undefined),
		};

		module = await Test.createTestingModule({
			providers: [
				NotificationQueueProcessor,
				{
					provide: NotificationSender,
					inject: [
						SendNotificationUseCase,
						SendNotificationWithDedupUseCase,
						SendBatchNotificationUseCase,
						FindAlreadyNotifiedUsersUseCase,
						PUSH_DISPATCHER,
					],
					useFactory: (
						sendNotification: SendNotificationUseCase,
						sendWithDedup: SendNotificationWithDedupUseCase,
						sendBatch: SendBatchNotificationUseCase,
						findAlreadyNotified: FindAlreadyNotifiedUsersUseCase,
						pushDispatcher: PushDispatcherPort,
					) =>
						new NotificationSender(
							sendNotification,
							sendWithDedup,
							sendBatch,
							findAlreadyNotified,
							pushDispatcher,
						),
				},
				{
					provide: NotificationBatchDispatcher,
					inject: [
						PersistBatchNotificationUseCase,
						DispatchBatchNotificationUseCase,
					],
					useFactory: (
						persistBatch: PersistBatchNotificationUseCase,
						dispatchBatch: DispatchBatchNotificationUseCase,
					) => new NotificationBatchDispatcher(persistBatch, dispatchBatch),
				},
				PersistBatchNotificationUseCase,
				DispatchBatchNotificationUseCase,
				SendBatchNotificationUseCase,
				FindAlreadyNotifiedUsersUseCase,
				{ provide: GetNotificationsUseCase, useValue: unusedUseCase },
				{ provide: GetUnreadCountUseCase, useValue: unusedUseCase },
				{ provide: MarkAsReadUseCase, useValue: unusedUseCase },
				{ provide: MarkNotificationOpenedUseCase, useValue: unusedUseCase },
				{ provide: MarkAllAsReadUseCase, useValue: unusedUseCase },
				{ provide: RegisterPushTokenUseCase, useValue: unusedUseCase },
				{ provide: UnregisterPushTokenUseCase, useValue: unusedUseCase },
				{ provide: OptOutMarketingPushUseCase, useValue: unusedUseCase },
				{ provide: SendNotificationUseCase, useValue: unusedUseCase },
				{ provide: SendNotificationWithDedupUseCase, useValue: unusedUseCase },
				{ provide: UNIT_OF_WORK, useValue: uow },
				{ provide: NOTIFICATION_REPOSITORY, useValue: repository },
				{ provide: PUSH_DISPATCHER, useValue: dispatcher },
				{
					provide: NOTIFICATION_CACHE,
					useValue: {
						wrapUnreadCount: jest.fn(),
						invalidateUnreadCount: jest.fn().mockResolvedValue(undefined),
						invalidatePushTokens: jest.fn(),
						invalidateUserPreference: jest.fn(),
					},
				},
				{
					provide: NOTIFICATION_DEDUP,
					useValue: {
						recordNotifiedUsers: jest.fn().mockResolvedValue(undefined),
						readKnownRecipients: jest.fn().mockResolvedValue(new Set()),
						warmRecipients: jest.fn().mockResolvedValue(undefined),
					},
				},
				{ provide: DEDUP_PROVIDER, useValue: dedupProvider },
				{
					provide: TransactionHost,
					useValue: {
						tx: {
							userPreference: {
								findMany: jest.fn().mockResolvedValue([]),
							},
						},
					},
				},
				{
					provide: PUSH_PROVIDER,
					useValue: {
						name: "fake",
						send: jest.fn(),
						sendBatch: jest.fn(),
						validateToken: jest.fn(),
						getReceipts: jest.fn(),
					},
				},
			],
		}).compile();

		processor = module.get(NotificationQueueProcessor);
	});

	afterEach(async () => {
		await module?.close();
	});

	it("schedules delivery without inheriting the completed persistence transaction", async () => {
		const job: NamedJob<NotificationJobMap> = {
			name: NotificationJobName.FRIEND_COMPLETED,
			data: {
				friendId: "friend-1",
				friendName: "완료 친구",
				notifyUserIds: ["user-1"],
				timezone: "Asia/Seoul",
			},
		};

		await processor.process(job);

		expect(dispatcher.scheduledBatchCount).toBe(1);
		await expect(dispatcher.drain()).resolves.toBeUndefined();
	});
});
