import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import {
	NUDGE_REPOSITORY,
	type NudgeRepositoryPort,
} from "../ports/nudge.repository.port";
import { NudgeReader } from "./nudge.reader";

describe("NudgeReader — 사용자 로컬 일일 한도", () => {
	let reader: NudgeReader;
	let repository: Mocked<NudgeRepositoryPort>;
	let entitlement: Mocked<EntitlementService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(NudgeReader).compile();
		reader = unit;
		repository = unitRef.get(NUDGE_REPOSITORY);
		entitlement = unitRef.get(EntitlementService);
		entitlement.getFeatureLimit.mockResolvedValue({
			dailyLimit: 3,
			isAdmin: false,
			subscriptionStatus: "FREE",
		});
		entitlement.calculateRemaining.mockImplementation((limit, used) =>
			limit === null ? null : Math.max(0, limit - used),
		);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("Asia/Seoul 현재 일자의 실제 UTC 자정 범위로 used와 remaining을 계산한다", async () => {
		// Given - 7/26 KST는 7/25 15:00Z부터 7/26 15:00Z 직전까지
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-07-26T00:30:00.000Z"));
		repository.countSentSince.mockResolvedValue(1);

		// When
		const result = await reader.getLimitInfo("sender", "Asia/Seoul");

		// Then
		expect(result).toEqual({ dailyLimit: 3, used: 1, remaining: 2 });
		expect(repository.countSentSince).toHaveBeenCalledWith(
			"sender",
			new Date("2026-07-25T15:00:00.000Z"),
			new Date("2026-07-26T15:00:00.000Z"),
		);
	});
});
