/**
 * GetAiUsageHandler 단위 테스트
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import {
	AI_USAGE_REPOSITORY,
	type AiUsageRepositoryPort,
} from "../../ports/ai-usage.repository.port";
import { GetAiUsageQuery } from "../get-ai-usage.query";
import { GetAiUsageHandler } from "./get-ai-usage.handler";

describe("GetAiUsageHandler — AI 사용량 조회 핸들러", () => {
	let handler: GetAiUsageHandler;
	let repository: Mocked<AiUsageRepositoryPort>;
	let entitlement: Mocked<EntitlementService>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(GetAiUsageHandler).compile();
		handler = unit;
		repository = unitRef.get(AI_USAGE_REPOSITORY);
		entitlement = unitRef.get(EntitlementService);

		entitlement.getFeatureLimit.mockResolvedValue({
			dailyLimit: 5,
			isAdmin: false,
			subscriptionStatus: "",
		});
	});

	it("같은 달이면 실제 카운트와 한도를 반환한다", async () => {
		repository.findUsage.mockResolvedValue({ count: 3, resetAt: new Date() });

		const usage = await handler.execute(new GetAiUsageQuery("user-1"));

		expect(usage.used).toBe(3);
		expect(usage.limit).toBe(5);
		expect(usage.resetsAt).toEqual(expect.any(String));
	});

	it("새로운 달이면 used=0으로 표시한다", async () => {
		repository.findUsage.mockResolvedValue({
			count: 5,
			resetAt: new Date("2020-01-01T00:00:00.000Z"),
		});

		const usage = await handler.execute(new GetAiUsageQuery("user-1"));

		expect(usage.used).toBe(0);
	});

	it("사용자가 없으면 USER_0601을 던진다", async () => {
		repository.findUsage.mockResolvedValue(null);

		await expect(
			handler.execute(new GetAiUsageQuery("user-1")),
		).rejects.toMatchObject({ errorCode: "USER_0601" });
	});
});
