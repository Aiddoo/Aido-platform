/**
 * FindAlreadyNotifiedUsersUseCase 단위 테스트
 *
 * - warm(센티넬 존재): Redis 결과 신뢰, 센티넬 제거 후 반환 (DB 미조회)
 * - cold(센티넬 없음): DB fallback + Redis warm-up(addMembers)
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { DedupKeys } from "@/shared/infrastructure/dedup/constants/dedup-keys";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import {
	NOTIFICATION_REPOSITORY,
	type NotificationRepositoryPort,
} from "../../ports/notification.repository.port";
import { FindAlreadyNotifiedUsersUseCase } from "./find-already-notified-users.use-case";

const params = {
	userIds: ["user-1", "user-2"],
	type: "FRIEND_COMPLETED" as const,
	notificationDate: new Date("2026-03-09T00:00:00.000Z"),
	friendId: "friend-1",
};

describe("FindAlreadyNotifiedUsersUseCase", () => {
	let useCase: FindAlreadyNotifiedUsersUseCase;
	let dedupProvider: Mocked<IDedupProvider>;
	let repository: Mocked<NotificationRepositoryPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			FindAlreadyNotifiedUsersUseCase,
		).compile();
		useCase = unit;
		dedupProvider = unitRef.get(DEDUP_PROVIDER);
		repository = unitRef.get(NOTIFICATION_REPOSITORY);
	});

	it("warm(센티넬 존재): Redis 결과에서 센티넬 제거 후 반환, DB 미조회", async () => {
		dedupProvider.filterMembers.mockResolvedValue(
			new Set([DedupKeys.SENTINEL, "user-1"]),
		);

		const result = await useCase.execute(params);

		expect(result).toEqual(new Set(["user-1"]));
		expect(repository.findAlreadyNotifiedUserIds).not.toHaveBeenCalled();
		expect(dedupProvider.addMembers).not.toHaveBeenCalled();
	});

	it("cold(센티넬 없음): DB fallback + Redis warm-up", async () => {
		dedupProvider.filterMembers.mockResolvedValue(new Set());
		repository.findAlreadyNotifiedUserIds.mockResolvedValue(
			new Set(["user-2"]),
		);

		const result = await useCase.execute(params);

		expect(result).toEqual(new Set(["user-2"]));
		expect(repository.findAlreadyNotifiedUserIds).toHaveBeenCalledWith(params);
		expect(dedupProvider.addMembers).toHaveBeenCalledWith(
			DedupKeys.notified(params.type, params.notificationDate),
			[DedupKeys.SENTINEL, "user-2"],
			DedupKeys.TTL.NOTIFIED,
		);
	});
});
