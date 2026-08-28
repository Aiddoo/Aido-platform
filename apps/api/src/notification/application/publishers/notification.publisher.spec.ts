import type { SendBatchNotificationUseCase } from "../use-cases/send-batch-notification/send-batch-notification.use-case";
import type { SendNotificationWithDedupUseCase } from "../use-cases/send-notification-with-dedup/send-notification-with-dedup.use-case";
import type { SendNotificationUseCase } from "../use-cases/send-notification/send-notification.use-case";
import { NotificationPublisher } from "./notification.publisher";

describe("NotificationPublisher", () => {
	it("발행 요청을 목적별 유스케이스에 위임한다", async () => {
		const send = { execute: jest.fn().mockResolvedValue(null) };
		const sendWithDeduplication = { execute: jest.fn().mockResolvedValue(null) };
		const sendBatch = { execute: jest.fn().mockResolvedValue({ count: 1 }) };
		const publisher = new NotificationPublisher(
			send as unknown as SendNotificationUseCase,
			sendWithDeduplication as unknown as SendNotificationWithDedupUseCase,
			sendBatch as unknown as SendBatchNotificationUseCase,
		);
		const input = { userId: "user-1", type: "SYSTEM_NOTICE" as const, title: "제목", body: "본문" };

		await publisher.publish(input);
		await publisher.publishWithDeduplication(input);
		await publisher.publishBatch([input]);

		expect(send.execute).toHaveBeenCalledWith(input);
		expect(sendWithDeduplication.execute).toHaveBeenCalledWith(input);
		expect(sendBatch.execute).toHaveBeenCalledWith([input]);
	});
});
