/**
 * KmaLifestyleIndexProvider 단위 테스트
 *
 * @description
 * UV 지수 API 호출 및 체감온도 계산 검증.
 * fetch를 전역 spy로 Mock.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test kma-lifestyle-index.provider.spec
 * ```
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { TypedConfigService } from "@/common/config/services/config.service";

import { KmaLifestyleIndexProvider } from "./kma-lifestyle-index.provider";

describe("KmaLifestyleIndexProvider", () => {
	let provider: KmaLifestyleIndexProvider;
	let configService: Mocked<TypedConfigService>;
	let fetchSpy: jest.SpiedFunction<typeof globalThis.fetch>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			KmaLifestyleIndexProvider,
		).compile();

		provider = unit;
		configService = unitRef.get(TypedConfigService);

		fetchSpy = jest.spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	// ========================================
	// getIndex
	// ========================================

	describe("getIndex", () => {
		const lat = 37.5;
		const lon = 126.9;
		const date = new Date("2024-07-15T12:00:00Z");
		const currentTemp = 30;
		const windSpeed = 5;

		it("정상 응답 시 UV 지수와 체감온도를 반환해야 한다", async () => {
			// Given - API 키 설정 및 정상 UV 응답 준비
			Object.defineProperty(configService, "dataGoKrApiKey", {
				get: () => "test-api-key",
			});
			fetchSpy.mockResolvedValue(
				new Response(
					JSON.stringify({
						response: {
							header: { resultCode: "00" },
							body: {
								items: {
									item: [{ h0: "7" }],
								},
							},
						},
					}),
				),
			);

			// When - 생활지수 조회
			const result = await provider.getIndex(
				lat,
				lon,
				date,
				currentTemp,
				windSpeed,
			);

			// Then - UV 지수와 체감온도 반환 확인
			expect(result).not.toBeNull();
			expect(result?.uvIndex).toBe(7);
			// temp > 10이므로 체감온도 = 기온 그대로
			expect(result?.feelsLikeTemperature).toBe(currentTemp);
		});

		it("API 키가 없으면 null을 반환해야 한다", async () => {
			// Given - API 키 미설정
			Object.defineProperty(configService, "dataGoKrApiKey", {
				get: () => undefined,
			});

			// When - 생활지수 조회
			const result = await provider.getIndex(
				lat,
				lon,
				date,
				currentTemp,
				windSpeed,
			);

			// Then - null 반환 및 fetch 미호출
			expect(result).toBeNull();
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it("API 에러 시 null을 반환해야 한다", async () => {
			// Given - API 키 설정 및 fetch 네트워크 에러
			Object.defineProperty(configService, "dataGoKrApiKey", {
				get: () => "test-api-key",
			});
			fetchSpy.mockRejectedValue(new Error("Network error"));

			// When - 생활지수 조회
			const result = await provider.getIndex(
				lat,
				lon,
				date,
				currentTemp,
				windSpeed,
			);

			// Then - null 반환
			expect(result).toBeNull();
		});

		it("타임아웃 시 null을 반환해야 한다", async () => {
			// Given - API 키 설정 및 fetch 타임아웃
			Object.defineProperty(configService, "dataGoKrApiKey", {
				get: () => "test-api-key",
			});
			fetchSpy.mockRejectedValue(new DOMException("Aborted", "AbortError"));

			// When - 생활지수 조회
			const result = await provider.getIndex(
				lat,
				lon,
				date,
				currentTemp,
				windSpeed,
			);

			// Then - null 반환
			expect(result).toBeNull();
		});

		it("풍속과 기온 조건에 따라 체감온도를 올바르게 계산해야 한다", async () => {
			// Given - 체감온도 공식 적용 조건: temp <= 10, windSpeed >= 1.3
			const coldTemp = 5;
			const highWind = 20;
			Object.defineProperty(configService, "dataGoKrApiKey", {
				get: () => "test-api-key",
			});
			fetchSpy.mockResolvedValue(
				new Response(
					JSON.stringify({
						response: {
							header: { resultCode: "00" },
							body: {
								items: {
									item: [{ h0: "3" }],
								},
							},
						},
					}),
				),
			);

			// When - 체감온도 공식 적용 조건으로 조회
			const result = await provider.getIndex(
				lat,
				lon,
				date,
				coldTemp,
				highWind,
			);

			// Then - Wind Chill 공식에 따라 계산된 체감온도 확인
			expect(result).not.toBeNull();
			const v016 = highWind ** 0.16;
			const expectedFeelsLike =
				13.12 + 0.6215 * coldTemp - 11.37 * v016 + 0.3965 * coldTemp * v016;
			expect(result?.feelsLikeTemperature).toBeCloseTo(expectedFeelsLike, 2);
			expect(result?.uvIndex).toBe(3);
		});
	});
});
