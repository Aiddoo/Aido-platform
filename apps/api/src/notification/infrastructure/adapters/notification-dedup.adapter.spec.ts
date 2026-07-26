import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import {
	DEDUP_PROVIDER,
	type IDedupProvider,
} from "@/shared/infrastructure/dedup/interfaces/dedup.interface";
import { NotificationDedupAdapter } from "./notification-dedup.adapter";

describe("NotificationDedupAdapter", () => {
	it("application dedup records를 인프라 key와 sentinel 계약으로 저장한다", async () => {
		const { unit, unitRef } = await TestBed.solitary(NotificationDedupAdapter)
			.mock<IDedupProvider>(DEDUP_PROVIDER)
			.impl(() => ({
				filterMembers: jest.fn(),
				isMember: jest.fn(),
				addMembers: jest.fn().mockResolvedValue(undefined),
			}))
			.compile();
		const provider: Mocked<IDedupProvider> = unitRef.get(DEDUP_PROVIDER);

		await unit.recordNotifiedUsers([
			{
				userId: "u1",
				type: "FRIEND_COMPLETED",
				notificationDate: new Date("2026-03-09T00:00:00.000Z"),
			},
			{
				userId: "u2",
				type: "FRIEND_COMPLETED",
				notificationDate: new Date("2026-03-09T00:00:00.000Z"),
			},
		]);

		expect(provider.addMembers).toHaveBeenCalledWith(
			"aido:v1:notification:dedup-notified:FRIEND_COMPLETED:2026-03-09",
			["__init__", "u1", "u2"],
			90_000_000,
		);
	});
});
