import {
	NOTIFICATION_JOB_POLICY,
	NOTIFICATION_QUEUE,
	NOTIFICATION_WORKER_POLICY,
	NotificationJobName,
	NotificationRuntimeJobSchema,
	PUSH_RECEIPT_SCHEDULE,
} from "./notification-queue.constants";

describe("Notification queue contract", () => {
	it("queue 이름과 운영 정책을 기존 계약으로 유지한다", () => {
		expect(NOTIFICATION_QUEUE).toBe("notification.v1");
		expect(NOTIFICATION_JOB_POLICY).toEqual({
			retryLimit: 2,
			retryDelaySeconds: 1,
			retryBackoff: true,
			expireInSeconds: 300,
			retentionSeconds: 604_800,
			deleteAfterSeconds: 86_400,
		});
		expect(NOTIFICATION_WORKER_POLICY).toEqual({
			teamSize: 5,
			pollingIntervalSeconds: 2,
		});
		expect(PUSH_RECEIPT_SCHEDULE).toEqual({
			key: "push-receipts-scheduler",
			cron: "*/5 * * * *",
		});
	});

	it("job 이름과 payload의 상관관계를 런타임에도 검증한다", () => {
		expect(
			NotificationRuntimeJobSchema.safeParse({
				name: NotificationJobName.FOLLOW_NEW,
				data: {
					followerId: "follower-1",
					followingId: "following-1",
					followerName: "Aido",
				},
			}).success,
		).toBe(true);
		expect(
			NotificationRuntimeJobSchema.safeParse({
				name: NotificationJobName.FOLLOW_NEW,
				data: { userId: "wrong-payload" },
			}).success,
		).toBe(false);
	});
});
