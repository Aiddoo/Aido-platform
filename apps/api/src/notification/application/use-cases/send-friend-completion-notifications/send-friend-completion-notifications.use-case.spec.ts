import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";

import { DuplicateNotificationError } from "../../ports/notification.repository.port";
import {
	USER_NOTIFICATION_SETTINGS,
	type UserNotificationSettingsPort,
} from "../../ports/user-notification-settings.port";
import { NotificationSender } from "../../senders/notification.sender";
import { DispatchBatchNotificationUseCase } from "../dispatch-batch-notification/dispatch-batch-notification.use-case";
import { PersistBatchNotificationUseCase } from "../persist-batch-notification/persist-batch-notification.use-case";
import { SendFriendCompletionNotificationsUseCase } from "./send-friend-completion-notifications.use-case";

const input = {
	friendId: "friend-1",
	friendName: "민재",
	notifyUserIds: ["user-1", "user-2"],
	timezone: "Asia/Seoul",
};

describe("SendFriendCompletionNotificationsUseCase", () => {
	let useCase: SendFriendCompletionNotificationsUseCase;
	let notificationSender: Mocked<NotificationSender>;
	let persistBatch: Mocked<PersistBatchNotificationUseCase>;
	let dispatchBatch: Mocked<DispatchBatchNotificationUseCase>;
	let unitOfWork: Mocked<UnitOfWorkPort>;
	let userSettings: Mocked<UserNotificationSettingsPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			SendFriendCompletionNotificationsUseCase,
		).compile();
		useCase = unit;
		notificationSender = unitRef.get(NotificationSender);
		persistBatch = unitRef.get(PersistBatchNotificationUseCase);
		dispatchBatch = unitRef.get(DispatchBatchNotificationUseCase);
		unitOfWork = unitRef.get(UNIT_OF_WORK);
		userSettings = unitRef.get(USER_NOTIFICATION_SETTINGS);
		notificationSender.findAlreadyNotifiedUserIds.mockResolvedValue(new Set());
		userSettings.getPreferenceRecordsByUserIds.mockResolvedValue([]);
		unitOfWork.run.mockImplementation((work) => work());
		persistBatch.execute.mockResolvedValue({ count: 2, items: [], sourceData: [] });
		dispatchBatch.execute.mockResolvedValue({ count: 2 });
	});

	it("performs external reads before the UoW and dispatches only after persistence", async () => {
		const events: string[] = [];
		notificationSender.findAlreadyNotifiedUserIds.mockImplementation(async () => {
			events.push("dedup-read");
			return new Set();
		});
		userSettings.getPreferenceRecordsByUserIds.mockImplementation(async () => {
			events.push("preference-read");
			return [];
		});
		unitOfWork.run.mockImplementation(async (work) => {
			events.push("uow-start");
			const result = await work();
			events.push("uow-end");
			return result;
		});
		persistBatch.execute.mockImplementation(async (notifications) => {
			events.push("persist");
			return { count: notifications.length, items: [], sourceData: notifications };
		});
		dispatchBatch.execute.mockImplementation(async () => {
			events.push("dispatch");
			return { count: 2 };
		});

		await useCase.execute(input);

		expect(events).toEqual([
			"dedup-read",
			"preference-read",
			"uow-start",
			"persist",
			"uow-end",
			"dispatch",
		]);
		expect(persistBatch.execute).toHaveBeenCalledWith(
			expect.arrayContaining([
				expect.objectContaining({ userId: "user-1", friendId: "friend-1" }),
				expect.objectContaining({ userId: "user-2", friendId: "friend-1" }),
			]),
		);
	});

	it("filters recipients already notified and skips when none remain", async () => {
		notificationSender.findAlreadyNotifiedUserIds.mockResolvedValue(new Set(["user-1", "user-2"]));

		await useCase.execute(input);

		expect(userSettings.getPreferenceRecordsByUserIds).not.toHaveBeenCalled();
		expect(unitOfWork.run).not.toHaveBeenCalled();
	});

	it("treats the persistence duplicate error as a successful race loss", async () => {
		unitOfWork.run.mockRejectedValue(new DuplicateNotificationError());

		await expect(useCase.execute(input)).resolves.toBeUndefined();
		expect(dispatchBatch.execute).not.toHaveBeenCalled();
	});
});
