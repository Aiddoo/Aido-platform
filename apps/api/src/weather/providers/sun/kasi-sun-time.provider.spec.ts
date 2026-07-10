/**
 * KasiSunTimeProvider 단위 테스트
 *
 * @description
 * KASI 일출/일몰 API 호출 및 시각 포맷 변환 검증.
 * fetch를 전역 spy로 Mock.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test kasi-sun-time.provider.spec
 * ```
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

import { KasiSunTimeProvider } from "./kasi-sun-time.provider";

describe("KasiSunTimeProvider — KASI 일출일몰 프로바이더", () => {
	let provider: KasiSunTimeProvider;
	let configService: Mocked<TypedConfigService>;
	let fetchSpy: jest.SpiedFunction<typeof globalThis.fetch>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(KasiSunTimeProvider).compile();

		provider = unit;
		configService = unitRef.get(TypedConfigService);

		fetchSpy = jest.spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("getSunTime", () => {
		const lat = 37.5;
		const lon = 126.9;
		const date = new Date("2024-07-15");

		it('정상 응답 시 일출/일몰 시각을 "HH:mm" 형식으로 반환해야 한다', async () => {
			// Given - API 키 설정 및 정상 일출/일몰 응답 준비
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
									item: {
										sunrise: "0532",
										sunset: "1945",
									},
								},
							},
						},
					}),
				),
			);

			// When - 일출/일몰 시각 조회
			const result = await provider.getSunTime(lat, lon, date);

			// Then - HH:mm 형식으로 반환 확인
			expect(result).not.toBeNull();
			expect(result?.sunrise).toBe("05:32");
			expect(result?.sunset).toBe("19:45");
		});

		it("API 키가 없으면 null을 반환해야 한다", async () => {
			// Given - API 키 미설정
			Object.defineProperty(configService, "dataGoKrApiKey", {
				get: () => undefined,
			});

			// When - 일출/일몰 시각 조회
			const result = await provider.getSunTime(lat, lon, date);

			// Then - null 반환 및 fetch 미호출
			expect(result).toBeNull();
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it("API 에러 시 null을 반환해야 한다", async () => {
			// Given - API 키 설정 및 fetch 실패
			Object.defineProperty(configService, "dataGoKrApiKey", {
				get: () => "test-api-key",
			});
			fetchSpy.mockResolvedValue(
				new Response(null, {
					status: 500,
					statusText: "Internal Server Error",
				}),
			);

			// When - 일출/일몰 시각 조회
			const result = await provider.getSunTime(lat, lon, date);

			// Then - null 반환
			expect(result).toBeNull();
		});

		it("빈 응답 시 null을 반환해야 한다", async () => {
			// Given - API 키 설정 및 item이 없는 응답
			Object.defineProperty(configService, "dataGoKrApiKey", {
				get: () => "test-api-key",
			});
			fetchSpy.mockResolvedValue(
				new Response(
					JSON.stringify({
						response: {
							header: { resultCode: "00" },
							body: {
								items: {},
							},
						},
					}),
				),
			);

			// When - 일출/일몰 시각 조회
			const result = await provider.getSunTime(lat, lon, date);

			// Then - null 반환
			expect(result).toBeNull();
		});
	});
});
