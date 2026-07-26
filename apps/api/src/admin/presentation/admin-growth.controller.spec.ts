import type { CurrentUserPayload } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { IS_ADMIN_KEY } from "@/auth/presentation/decorators/admin.decorator";
import { AdminFacade } from "../application/facades/admin.facade";
import { AdminGrowthController } from "./admin-growth.controller";

describe("AdminGrowthController — 관리자 성장 지표", () => {
	it("관리자 전용 summary 요청을 facade에 위임한다", async () => {
		// Given - 관리자 컨트롤러, facade, 명시 cohort 범위
		const { unit, unitRef } = await TestBed.solitary(
			AdminGrowthController,
		).compile();
		const facade: Mocked<AdminFacade> = unitRef.get(AdminFacade);
		const admin: CurrentUserPayload = {
			userId: "admin-1",
			email: "admin@example.com",
			sessionId: "session-1",
			role: "ADMIN",
		};
		const query = {
			cohortFrom: "2026-06-01",
			cohortTo: "2026-06-30",
		};
		const summary = {
			cohortFrom: "2026-06-01",
			cohortTo: "2026-06-30",
			measurementStartedAt: null,
			totalActiveUsers: 0,
			signups: 0,
			dau: 0,
			wau: 0,
			mau: 0,
			activation24h: { eligible: 0, achieved: 0, rate: 0 },
			d1: null,
			d7: null,
			d30: null,
			d7RetainedActivatedUsers: null,
		};
		facade.getGrowthSummary.mockResolvedValue(summary);

		// When - 성장 요약 endpoint를 호출하면
		const result = await unit.getGrowthSummary(admin, query);

		// Then - query를 그대로 위임하고 AdminGuard 메타데이터를 보존한다
		expect(facade.getGrowthSummary).toHaveBeenCalledWith(query);
		expect(result).toEqual(summary);
		expect(Reflect.getMetadata(IS_ADMIN_KEY, unit.getGrowthSummary)).toBe(true);
	});
});
