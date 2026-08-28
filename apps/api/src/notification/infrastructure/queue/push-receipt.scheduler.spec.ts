import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { JOB_RUNTIME, type JobRuntimePort } from "@/shared/application/ports";

import {
	NOTIFICATION_JOB_POLICY,
	NOTIFICATION_QUEUE,
	NotificationJobName,
	PUSH_RECEIPT_SCHEDULE,
} from "./notification-queue.constants";
import { PushReceiptScheduler } from "./push-receipt.scheduler";

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
