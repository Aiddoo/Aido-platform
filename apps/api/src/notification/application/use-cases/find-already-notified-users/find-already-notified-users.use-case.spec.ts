/**
 * FindAlreadyNotifiedUsersUseCase 단위 테스트
 *
 * - warm(센티넬 존재): Redis 결과 신뢰, 센티넬 제거 후 반환 (DB 미조회)
 * - cold(센티넬 없음): DB fallback + Redis warm-up(addMembers)
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import {
	NOTIFICATION_DEDUP,
	type NotificationDedupPort,
} from "../../ports/notification-dedup.port";
import {
	NOTIFICATION_HISTORY_READER,
	type NotificationHistoryReaderPort,
} from "../../ports/notification-history.reader.port";
import { FindAlreadyNotifiedUsersUseCase } from "./find-already-notified-users.use-case";

const params = {
	userIds: ["user-1", "user-2"],
	type: "FRIEND_COMPLETED" as const,
	notificationDate: new Date("2026-03-09T00:00:00.000Z"),
	friendId: "friend-1",
};

describe("FindAlreadyNotifiedUsersUseCase", () => {
	let useCase: FindAlreadyNotifiedUsersUseCase;
	let notificationDedup: Mocked<NotificationDedupPort>;
	let repository: Mocked<NotificationHistoryReaderPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(FindAlreadyNotifiedUsersUseCase).compile();
		useCase = unit;
		notificationDedup = unitRef.get(NOTIFICATION_DEDUP);
		repository = unitRef.get(NOTIFICATION_HISTORY_READER);
	});

	it("warm(센티넬 존재): Redis 결과에서 센티넬 제거 후 반환, DB 미조회", async () => {
		notificationDedup.readKnownRecipients.mockResolvedValue(new Set(["user-1"]));

		const result = await useCase.execute(params);

		expect(result).toEqual(new Set(["user-1"]));
		expect(repository.findAlreadyNotifiedUserIds).not.toHaveBeenCalled();
		expect(notificationDedup.warmRecipients).not.toHaveBeenCalled();
	});

	it("cold(센티넬 없음): DB fallback + Redis warm-up", async () => {
		notificationDedup.readKnownRecipients.mockResolvedValue(null);
		repository.findAlreadyNotifiedUserIds.mockResolvedValue(new Set(["user-2"]));

		const result = await useCase.execute(params);

		expect(result).toEqual(new Set(["user-2"]));
		expect(repository.findAlreadyNotifiedUserIds).toHaveBeenCalledWith(params);
		expect(notificationDedup.warmRecipients).toHaveBeenCalledWith(
			params.type,
			params.notificationDate,
			["user-2"],
		);
	});
});
