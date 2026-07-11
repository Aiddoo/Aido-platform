/**
 * AiUsageMeter 단위 테스트
 *
 * UoW·사용량 저장소·엔타이틀먼트를 스텁으로 대체해 한도 확인/원자적 증가/보상
 * 감소 로직만 검증한다.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { UNIT_OF_WORK, type UnitOfWorkPort } from "@/shared/application/ports";
import {
	AI_USAGE_REPOSITORY,
	type AiUsageRepositoryPort,
} from "../ports/ai-usage.repository.port";
import { AiUsageMeter } from "./ai-usage-meter.service";

describe("AiUsageMeter — AI 사용량 미터", () => {
	let meter: AiUsageMeter;
	let uow: Mocked<UnitOfWorkPort>;
	let repository: Mocked<AiUsageRepositoryPort>;
	let entitlement: Mocked<EntitlementService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AiUsageMeter).compile();
		meter = unit;
		uow = unitRef.get(UNIT_OF_WORK);
		repository = unitRef.get(AI_USAGE_REPOSITORY);
		entitlement = unitRef.get(EntitlementService);

		// UoW.run은 콜백을 실제로 실행해야 한다
		uow.run.mockImplementation(async (fn) => fn());
		entitlement.getFeatureLimit.mockResolvedValue({
			dailyLimit: 5,
			isAdmin: false,
			subscriptionStatus: "",
		});
	});

	describe("checkAndIncrement", () => {
		it("같은 달·한도 미만이면 카운트를 증가시킨다", async () => {
			repository.findUsage.mockResolvedValue({ count: 2, resetAt: new Date() });

			await meter.checkAndIncrement("user-1");

			expect(repository.increment).toHaveBeenCalledWith("user-1");
			expect(repository.resetAndIncrement).not.toHaveBeenCalled();
		});

		it("새로운 달이면 리셋 후 1로 설정한다", async () => {
			repository.findUsage.mockResolvedValue({
				count: 5,
				resetAt: new Date("2020-01-01T00:00:00.000Z"),
			});

			await meter.checkAndIncrement("user-1");

			expect(repository.resetAndIncrement).toHaveBeenCalledWith("user-1");
			expect(repository.increment).not.toHaveBeenCalled();
		});

		it("같은 달·한도 도달이면 AI_1303을 던지고 증가하지 않는다", async () => {
			repository.findUsage.mockResolvedValue({ count: 5, resetAt: new Date() });

			await expect(meter.checkAndIncrement("user-1")).rejects.toMatchObject({
				errorCode: "AI_1303",
			});
			expect(repository.increment).not.toHaveBeenCalled();
		});

		it("무제한(dailyLimit null)이면 한도 검사 없이 증가한다", async () => {
			entitlement.getFeatureLimit.mockResolvedValue({
				dailyLimit: null,
				isAdmin: true,
				subscriptionStatus: "ACTIVE",
			});
			repository.findUsage.mockResolvedValue({
				count: 999,
				resetAt: new Date(),
			});

			await meter.checkAndIncrement("user-1");

			expect(repository.increment).toHaveBeenCalledWith("user-1");
		});

		it("사용자가 없으면 USER_0601을 던진다", async () => {
			repository.findUsage.mockResolvedValue(null);

			await expect(meter.checkAndIncrement("user-1")).rejects.toMatchObject({
				errorCode: "USER_0601",
			});
		});
	});

	describe("decrement", () => {
		it("저장소 감소에 위임한다", async () => {
			await meter.decrement("user-1");
			expect(repository.decrement).toHaveBeenCalledWith("user-1");
		});

		it("감소 실패는 삼켜서 원래 에러 전파를 방해하지 않는다", async () => {
			repository.decrement.mockRejectedValue(new Error("db down"));
			await expect(meter.decrement("user-1")).resolves.toBeUndefined();
		});
	});
});
