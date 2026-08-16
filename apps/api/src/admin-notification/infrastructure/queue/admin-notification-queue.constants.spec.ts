import { JOB_POLLING_SECONDS } from "@/shared/application/ports";

import {
	ADMIN_NOTIFICATION_JOB_POLICY,
	ADMIN_NOTIFICATION_QUEUE,
	ADMIN_NOTIFICATION_WORKER_POLICY,
	AdminNotificationJobName,
	AdminNotificationRuntimeJobSchema,
	DAILY_SIGNUP_SUMMARY_SCHEDULE,
} from "./admin-notification-queue.constants";

describe("Admin notification queue contract", () => {
	it("queue 이름과 운영 정책을 기존 계약으로 유지한다", () => {
		expect(ADMIN_NOTIFICATION_QUEUE).toBe("admin-notification.v1");
		expect(ADMIN_NOTIFICATION_JOB_POLICY).toEqual({
			retryLimit: 2,
			retryDelaySeconds: 5,
			retryBackoff: true,
			expireInSeconds: 300,
			retentionSeconds: 86_400,
			deleteAfterSeconds: 86_400,
		});
		expect(ADMIN_NOTIFICATION_WORKER_POLICY).toEqual({
			teamSize: 3,
			// 관리자 공지는 사람이 기다리지 않는다 — 폴링은 예약 작업 주기를 따른다.
			pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED,
		});
		expect(DAILY_SIGNUP_SUMMARY_SCHEDULE.key).toBe("daily-signup-summary-scheduler");
		expect(DAILY_SIGNUP_SUMMARY_SCHEDULE.timezone).toBe("Asia/Seoul");
	});

	it("채널과 관리자 알림 payload를 런타임에도 검증한다", () => {
		expect(
			AdminNotificationRuntimeJobSchema.safeParse({
				name: AdminNotificationJobName.SEND,
				data: {
					channel: "payment",
					notification: { title: "결제", body: "완료" },
				},
			}).success,
		).toBe(true);
		expect(
			AdminNotificationRuntimeJobSchema.safeParse({
				name: AdminNotificationJobName.SEND,
				data: { channel: "unknown", notification: {} },
			}).success,
		).toBe(false);
	});
});
