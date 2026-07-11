/**
 * BullmqAdminNotificationQueueAdapter 단위 테스트
 *
 * - SEND 잡 등록 + 공통 옵션(재시도) 검증
 * - jobId 병합 검증
 */
import { getQueueToken } from "@nestjs/bullmq";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Queue } from "bullmq";
import { ADMIN_NOTIFICATION_QUEUE } from "../queue/admin-notification-queue.constants";
import { BullmqAdminNotificationQueueAdapter } from "./bullmq-admin-notification-queue.adapter";

describe("BullmqAdminNotificationQueueAdapter", () => {
	let adapter: BullmqAdminNotificationQueueAdapter;
	let queue: Mocked<Queue>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			BullmqAdminNotificationQueueAdapter,
		)
			.mock(getQueueToken(ADMIN_NOTIFICATION_QUEUE))
			.impl(() => ({ add: jest.fn().mockResolvedValue(undefined) }))
			.compile();

		adapter = unit;
		queue = unitRef.get(getQueueToken(ADMIN_NOTIFICATION_QUEUE));
	});

	it("SEND 잡을 공통 재시도 옵션으로 등록한다", async () => {
		await adapter.enqueueSend("admin", { title: "제목", body: "본문" });

		expect(queue.add).toHaveBeenCalledWith(
			"send-notification",
			{ channel: "admin", notification: { title: "제목", body: "본문" } },
			expect.objectContaining({
				attempts: 3,
				backoff: { type: "exponential", delay: 5_000 },
				removeOnComplete: true,
				removeOnFail: { count: 100, age: 86_400 },
			}),
		);
	});

	it("jobId 옵션을 공통 옵션에 병합한다", async () => {
		await adapter.enqueueSend(
			"admin",
			{ title: "제목", body: "본문" },
			{ jobId: "signup-summary_2026-02-10" },
		);

		const opts = queue.add.mock.calls[0]?.[2];
		expect(opts).toEqual(
			expect.objectContaining({
				attempts: 3,
				jobId: "signup-summary_2026-02-10",
			}),
		);
	});
});
