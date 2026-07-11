/**
 * ReportAccessService 단위 테스트
 *
 * enforcePremium: 프리미엄 사용자는 통과, 비프리미엄은 AI_1308.
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { ReportAccessService } from "./report-access.service";

describe("ReportAccessService — 리포트 접근 정책", () => {
	let service: ReportAccessService;
	let mockEntitlement: Mocked<EntitlementService>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(ReportAccessService).compile();
		service = unit;
		mockEntitlement = unitRef.get(EntitlementService);
	});

	it("프리미엄 사용자면 통과해야 한다", async () => {
		mockEntitlement.hasPremiumAccess.mockResolvedValue(true);

		await expect(service.enforcePremium("user-1")).resolves.toBeUndefined();
		expect(mockEntitlement.hasPremiumAccess).toHaveBeenCalledWith("user-1");
	});

	it("비프리미엄 사용자면 AI_1308 ApplicationException을 던져야 한다", async () => {
		mockEntitlement.hasPremiumAccess.mockResolvedValue(false);

		await expect(service.enforcePremium("user-1")).rejects.toBeInstanceOf(
			ApplicationException,
		);
		await expect(service.enforcePremium("user-1")).rejects.toMatchObject({
			errorCode: "AI_1308",
		});
	});
});
