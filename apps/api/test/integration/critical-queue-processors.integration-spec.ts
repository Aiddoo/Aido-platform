import type { PrismaClient } from "@/generated/prisma/client";
import {
	NOTIFICATION_QUEUE,
	NotificationJobName,
} from "@/notification/infrastructure/queue/notification-queue.constants";
import {
	RETENTION_QUEUE,
	RetentionJobName,
} from "@/retention/infrastructure/queue/retention-queue.constants";
import type { EnqueueJobOptions } from "@/shared/application/ports/job-runtime.port";

import {
	type CriticalQueueProcessorHarness,
	createCriticalQueueProcessorHarness,
} from "./helpers/critical-queue-processor.harness";

const JOB_OPTIONS: EnqueueJobOptions = {
	retryLimit: 1,
	retryDelaySeconds: 1,
	retryBackoff: false,
	expireInSeconds: 30,
	retentionSeconds: 60 * 60,
	deleteAfterSeconds: 60 * 60,
};

describe("핵심 큐 프로세서 컴포넌트 테스트 (실제 PostgreSQL + pg-boss)", () => {
	let harness: CriticalQueueProcessorHarness;

	beforeAll(async () => {
		harness = await createCriticalQueueProcessorHarness();
	}, 60_000);

	beforeEach(async () => {
		await harness.cleanup();
	});

	afterAll(async () => {
		await harness?.close();
	});

	it("friend-completed 잡은 실제 worker를 거쳐 알림과 푸시 전달 결과를 영속화한다", async () => {
		// Given
		const friend = await createPushReadyUser(harness.prisma, {
			email: "queue-friend@example.com",
			userTag: "FRIEND01",
			name: "완료 친구",
			locale: "ko",
			token: "fake-friend-token",
		});
		const koreanRecipient = await createPushReadyUser(harness.prisma, {
			email: "queue-ko@example.com",
			userTag: "QUEUEKO1",
			name: "한국어 수신자",
			locale: "ko",
			token: "fake-queue-ko-token",
		});
		const englishRecipient = await createPushReadyUser(harness.prisma, {
			email: "queue-en@example.com",
			userTag: "QUEUEEN1",
			name: "English recipient",
			locale: "en",
			token: "fake-queue-en-token",
		});

		// When
		const jobId = await harness.runtime.enqueue(
			NOTIFICATION_QUEUE,
			{
				name: NotificationJobName.FRIEND_COMPLETED,
				data: {
					friendId: friend.id,
					friendName: "완료 친구",
					notifyUserIds: [koreanRecipient.id, englishRecipient.id],
					timezone: "Asia/Seoul",
				},
			},
			{ ...JOB_OPTIONS, jobKey: `friend-completed:${friend.id}` },
		);

		// Then
		expect(jobId).not.toBeNull();
		await harness.eventually(async () => {
			const [notifications, dispatches, attempts, jobs] = await Promise.all([
				harness.prisma.notification.findMany({
					where: { type: "FRIEND_COMPLETED", friendId: friend.id },
					orderBy: { userId: "asc" },
				}),
				harness.prisma.pushDispatch.findMany({
					where: {
						notification: {
							type: "FRIEND_COMPLETED",
							friendId: friend.id,
						},
					},
				}),
				harness.prisma.pushDeliveryAttempt.findMany({
					where: {
						dispatch: {
							notification: {
								type: "FRIEND_COMPLETED",
								friendId: friend.id,
							},
						},
					},
				}),
				harness.boss.findJobs(NOTIFICATION_QUEUE, {
					id: jobId ?? undefined,
				}),
			]);

			expect(notifications).toHaveLength(2);
			expect(notifications.map(({ userId }) => userId).sort()).toEqual(
				[koreanRecipient.id, englishRecipient.id].sort(),
			);
			expect(notifications.every(({ notificationDate }) => notificationDate !== null)).toBe(true);
			expect(dispatches).toHaveLength(2);
			expect(dispatches.every(({ status }) => status === "SENT")).toBe(true);
			expect(attempts).toHaveLength(2);
			expect(attempts.every(({ status }) => status === "TICKET_ACCEPTED")).toBe(true);
			expect(jobs[0]?.state).toBe("completed");
		});
		expect(
			harness.pushProvider
				.getSentPayloads()
				.map(({ token }) => token)
				.sort(),
		).toEqual(["fake-queue-en-token", "fake-queue-ko-token"]);
	});

	it("retention-dispatch 잡은 실제 worker를 거쳐 전송 상태와 시도를 영속화한다", async () => {
		// Given
		const recipient = await createPushReadyUser(harness.prisma, {
			email: "queue-retention@example.com",
			userTag: "RETENT01",
			name: "리텐션 수신자",
			locale: "ko",
			token: "fake-retention-token",
			timezone: harness.daytimeTimezone,
		});
		await harness.retentionRepository.enroll({
			userId: recipient.id,
			variant: "TREATMENT",
			startedAt: new Date("2026-07-01T00:00:00.000Z"),
		});
		const stage = await harness.prisma.retentionExperimentStage.findFirstOrThrow({
			where: {
				assignment: { userId: recipient.id },
				stage: "D1",
			},
		});
		await harness.retentionRepository.createDelivery({
			stageId: stage.id,
			userId: recipient.id,
			timezone: harness.daytimeTimezone,
			title: "오늘 할 일을 이어가세요",
			body: "작은 할 일 하나로 다시 시작해 보세요.",
			route: "/feed",
			variantId: "d1_return",
		});
		const outbox = await harness.prisma.retentionPushOutbox.findUniqueOrThrow({
			where: { stageId: stage.id },
		});

		// When
		const jobId = await harness.runtime.enqueue(
			RETENTION_QUEUE,
			{
				name: RetentionJobName.DISPATCH,
				data: { outboxId: outbox.id },
			},
			{ ...JOB_OPTIONS, jobKey: `retention-dispatch:${outbox.id}` },
		);

		// Then
		expect(jobId).not.toBeNull();
		await harness.eventually(async () => {
			const [dispatch, attempts, jobs] = await Promise.all([
				harness.prisma.pushDispatch.findUniqueOrThrow({
					where: { id: outbox.dispatchId },
				}),
				harness.prisma.pushDeliveryAttempt.findMany({
					where: { dispatchId: outbox.dispatchId },
				}),
				harness.boss.findJobs(RETENTION_QUEUE, {
					id: jobId ?? undefined,
				}),
			]);

			expect(dispatch.status).toBe("SENT");
			expect(dispatch.sentAt).not.toBeNull();
			expect(attempts).toHaveLength(1);
			expect(attempts[0]?.status).toBe("TICKET_ACCEPTED");
			expect(jobs[0]?.state).toBe("completed");
		});
		expect(harness.pushProvider.getSentPayloads().map(({ token }) => token)).toEqual([
			"fake-retention-token",
		]);
	});
});

async function createPushReadyUser(
	prisma: PrismaClient,
	input: {
		email: string;
		userTag: string;
		name: string;
		locale: "ko" | "en";
		token: string;
		timezone?: string;
	},
): Promise<{ id: string }> {
	return prisma.user.create({
		data: {
			email: input.email,
			userTag: input.userTag,
			status: "ACTIVE",
			profile: { create: { name: input.name } },
			preference: {
				create: {
					pushEnabled: true,
					nightPushEnabled: true,
					timezone: input.timezone ?? "Asia/Seoul",
					locale: input.locale,
				},
			},
			consent: {
				create: {
					marketingPushAgreedAt: new Date("2026-07-01T00:00:00.000Z"),
				},
			},
			pushTokens: {
				create: {
					token: input.token,
					deviceId: `${input.userTag}-device`,
					platform: "IOS",
					appVersion: "1.8.0",
				},
			},
		},
		select: { id: true },
	});
}
