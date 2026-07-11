/**
 * HealthController 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Suites: TestBed.solitary()로 자동 Mock 생성
 * - GWT: Given/When/Then 주석으로 테스트 구조화
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { HealthCheckResult } from "@nestjs/terminus";
import { HealthCheckService } from "@nestjs/terminus";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { HealthController } from "./health.controller";

describe("HealthController — 헬스 체크 컨트롤러", () => {
	let controller: HealthController;
	let mockHealthCheckService: Mocked<HealthCheckService>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(HealthController).compile();

		controller = unit;
		mockHealthCheckService = unitRef.get(HealthCheckService);
	});

	describe("check", () => {
		it("헬스 체크 요청을 HealthCheckService에 위임하고 결과를 반환해야 한다", async () => {
			// Given -HealthCheckService가 정상 결과를 반환할 때
			const healthResult: HealthCheckResult = {
				status: "ok",
				info: { database: { status: "up" } },
				error: {},
				details: { database: { status: "up" } },
			};
			mockHealthCheckService.check.mockResolvedValue(healthResult);

			// When -check를 호출하면
			const result = await controller.check();

			// Then -HealthCheckService.check가 호출되고 결과를 반환해야 한다
			expect(mockHealthCheckService.check).toHaveBeenCalledWith(
				expect.any(Array),
			);
			expect(result).toMatchObject(healthResult);
			expect(result).toHaveProperty("instanceId");
			expect(typeof result.instanceId).toBe("string");
		});

		it("데이터베이스 연결 실패 시에도 결과를 반환해야 한다", async () => {
			// Given -데이터베이스 연결이 실패한 상태일 때
			const healthResult: HealthCheckResult = {
				status: "error",
				info: {},
				error: {
					database: { status: "down", message: "Connection refused" },
				},
				details: {
					database: { status: "down", message: "Connection refused" },
				},
			};
			mockHealthCheckService.check.mockResolvedValue(healthResult);

			// When -check를 호출하면
			const result = await controller.check();

			// Then -에러 상태의 결과를 반환해야 한다
			expect(result.status).toBe("error");
			expect(result.error).toHaveProperty("database");
		});
	});
});
