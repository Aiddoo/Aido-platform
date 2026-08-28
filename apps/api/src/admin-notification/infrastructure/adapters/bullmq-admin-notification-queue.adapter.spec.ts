/**
 * BullmqAdminNotificationQueueAdapter 단위 테스트
 *
 * - SEND 잡 등록 + 공통 옵션(재시도) 검증
 * - jobId 병합 검증
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { JOB_RUNTIME, type JobRuntimePort } from "@/shared/application/ports/job-runtime.port";

import { ADMIN_NOTIFICATION_QUEUE } from "../queue/admin-notification-queue.constants";
import { BullmqAdminNotificationQueueAdapter } from "./bullmq-admin-notification-queue.adapter";

describe("BullmqAdminNotificationQueueAdapter", () => {
	let adapter: BullmqAdminNotificationQueueAdapter;
	let runtime: Mocked<JobRuntimePort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(BullmqAdminNotificationQueueAdapter)
			.mock<JobRuntimePort>(JOB_RUNTIME)
			.impl(() => ({ enqueue: jest.fn().mockResolvedValue("job-1") }))
			.compile();

		adapter = unit;
		runtime = unitRef.get(JOB_RUNTIME);
	});

	it("SEND 잡을 공통 재시도 옵션으로 등록한다", async () => {
		await adapter.enqueueSend("admin", { title: "제목", body: "본문" });

		expect(runtime.enqueue).toHaveBeenCalledWith(
			ADMIN_NOTIFICATION_QUEUE,
			{
				name: "send-notification",
				data: {
					channel: "admin",
					notification: { title: "제목", body: "본문" },
				},
			},
			expect.objectContaining({
				retryLimit: 2,
				retryDelaySeconds: 5,
			}),
		);
	});

	it("jobId 옵션을 공통 옵션에 병합한다", async () => {
		await adapter.enqueueSend(
			"admin",
			{ title: "제목", body: "본문" },
			{ jobId: "signup-summary_2026-02-10" },
		);

		const opts = runtime.enqueue.mock.calls[0]?.[2];
		expect(opts).toEqual(
			expect.objectContaining({
				retryLimit: 2,
				idempotencyKey: "signup-summary_2026-02-10",
			}),
		);
	});
});
