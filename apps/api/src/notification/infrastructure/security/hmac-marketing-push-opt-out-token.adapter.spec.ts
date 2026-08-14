import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

import { HmacMarketingPushOptOutTokenAdapter } from "./hmac-marketing-push-opt-out-token.adapter";

describe("HmacMarketingPushOptOutTokenAdapter", () => {
	let adapter: HmacMarketingPushOptOutTokenAdapter;
	let config: Mocked<TypedConfigService>;

	beforeEach(async () => {
		jest.useFakeTimers();
		jest.setSystemTime(new Date("2026-07-14T12:00:00.000Z"));
		const testBed = await TestBed.solitary(HmacMarketingPushOptOutTokenAdapter).compile();
		adapter = testBed.unit;
		config = testBed.unitRef.get(TypedConfigService);
		Object.defineProperty(config, "jwtSecret", {
			get: () => "test-jwt-secret-at-least-32-characters",
		});
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("발급한 토큰에서 사용자 ID를 복원한다", () => {
		const token = adapter.issue("user.with.dots");

		expect(adapter.verify(token)).toBe("user.with.dots");
	});

	it("서명이 변조된 토큰을 거부한다", () => {
		const token = adapter.issue("user-1");
		const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;

		expect(adapter.verify(tampered)).toBeNull();
	});

	it("90일 유효기간이 지난 토큰을 기기 시각과 무관하게 거부한다", () => {
		const token = adapter.issue("user-1");
		jest.advanceTimersByTime(90 * 24 * 60 * 60 * 1000 + 1000);

		expect(adapter.verify(token)).toBeNull();
	});
});
