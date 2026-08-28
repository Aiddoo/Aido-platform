import type { FindAlreadyNotifiedUsersUseCase } from "../use-cases/find-already-notified-users/find-already-notified-users.use-case";
import { NotificationHistoryReader } from "./notification-history.reader";

describe("NotificationHistoryReader", () => {
	it("캐시와 DB fallback을 소유한 조회 유스케이스에 위임한다", async () => {
		const recipients = new Set(["user-1"]);
		const useCase = { execute: jest.fn().mockResolvedValue(recipients) };
		const reader = new NotificationHistoryReader(
			useCase as unknown as FindAlreadyNotifiedUsersUseCase,
		);
		const query = {
			userIds: ["user-1"],
			type: "MORNING_REMINDER" as const,
			notificationDate: new Date("2026-08-29T00:00:00.000Z"),
		};

		await expect(reader.findAlreadyNotifiedUserIds(query)).resolves.toBe(recipients);
		expect(useCase.execute).toHaveBeenCalledWith(query);
	});
});
