import { TestBed } from "@suites/unit";
import type { Mocked } from "vitest";

import { JOB_RUNTIME, type JobRuntimePort } from "#api/shared/application/ports/index";

import {
	NOTIFICATION_JOB_POLICY,
	NOTIFICATION_QUEUE,
	NotificationJobName,
	PUSH_RECEIPT_SCHEDULE,
} from "./notification-queue.constants.js";
import { PushReceiptScheduler } from "./push-receipt.scheduler.js";

describe("PushReceiptScheduler", () => {
	it("registers the existing receipt cron and retry policy", async () => {
		const { unit, unitRef } = await TestBed.solitary(PushReceiptScheduler).compile();
		const runtime: Mocked<JobRuntimePort> = unitRef.get(JOB_RUNTIME);

		await unit.onModuleInit();

		expect(runtime.schedule).toHaveBeenCalledWith(
			PUSH_RECEIPT_SCHEDULE.key,
			PUSH_RECEIPT_SCHEDULE.cron,
			NOTIFICATION_QUEUE,
			{ name: NotificationJobName.PUSH_RECEIPTS, data: {} },
			NOTIFICATION_JOB_POLICY,
		);
	});
});
