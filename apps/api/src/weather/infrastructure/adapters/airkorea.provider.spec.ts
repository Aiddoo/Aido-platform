/**
 * AirkoreaProvider 단위 테스트
 *
 * @description
 * 에어코리아 측정소 조회 및 대기질 API 호출 검증.
 * fetch를 전역 spy로 Mock.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test airkorea.provider.spec
 * ```
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

import { AirkoreaProvider } from "./airkorea.provider";

describe("AirkoreaProvider — 에어코리아 대기질 프로바이더", () => {
	let provider: AirkoreaProvider;
	let configService: Mocked<TypedConfigService>;
	let fetchSpy: jest.SpiedFunction<typeof globalThis.fetch>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AirkoreaProvider).compile();

		provider = unit;
		configService = unitRef.get(TypedConfigService);

		fetchSpy = jest.spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	describe("getAirQuality", () => {
		const lat = 37.5;
		const lon = 126.9;

		const mockStationResponse = (stationName: string) =>
			new Response(
				JSON.stringify({
					response: {
						body: {
							items: [{ stationName }],
						},
					},
				}),
			);

		const mockAirQualityResponse = (pm10Value: string, pm25Value: string) =>
			new Response(
				JSON.stringify({
					response: {
						body: {
							items: [{ pm10Value, pm25Value }],
						},
					},
				}),
			);

		it("정상 응답 시 PM10/PM25 값을 반환해야 한다", async () => {
			// Given - API 키 설정 및 측정소/대기질 정상 응답 준비
			Object.defineProperty(configService, "dataGoKrApiKey", {
				get: () => "test-api-key",
			});
			fetchSpy
				.mockResolvedValueOnce(mockStationResponse("종로구"))
				.mockResolvedValueOnce(mockAirQualityResponse("45", "23"));

			// When - 대기질 조회
			const result = await provider.getAirQuality(lat, lon);

			// Then - PM10/PM25 숫자 값 반환 확인
			expect(result).not.toBeNull();
			expect(result?.pm10).toBe(45);
			expect(result?.pm25).toBe(23);
			expect(fetchSpy).toHaveBeenCalledTimes(2);
		});

		it("API 키가 없으면 null을 반환해야 한다", async () => {
			// Given - API 키 미설정
			Object.defineProperty(configService, "dataGoKrApiKey", {
				get: () => undefined,
			});

			// When - 대기질 조회
			const result = await provider.getAirQuality(lat, lon);

			// Then - null 반환 및 fetch 미호출
			expect(result).toBeNull();
			expect(fetchSpy).not.toHaveBeenCalled();
		});

		it("측정소 조회 실패 시 null을 반환해야 한다", async () => {
			// Given - API 키 설정 및 측정소 조회 실패
			Object.defineProperty(configService, "dataGoKrApiKey", {
				get: () => "test-api-key",
			});
			fetchSpy.mockResolvedValueOnce(
				new Response(null, {
					status: 500,
					statusText: "Internal Server Error",
				}),
			);

			// When - 대기질 조회
			const result = await provider.getAirQuality(lat, lon);

			// Then - null 반환 및 대기질 API 미호출
			expect(result).toBeNull();
			expect(fetchSpy).toHaveBeenCalledTimes(1);
		});

		it('측정값이 "-"이면 해당 필드를 null로 반환해야 한다', async () => {
			// Given - API 키 설정 및 측정값이 "-"인 응답
			Object.defineProperty(configService, "dataGoKrApiKey", {
				get: () => "test-api-key",
			});
			fetchSpy
				.mockResolvedValueOnce(mockStationResponse("종로구"))
				.mockResolvedValueOnce(mockAirQualityResponse("-", "-"));

			// When - 대기질 조회
			const result = await provider.getAirQuality(lat, lon);

			// Then - PM10/PM25 모두 null
			expect(result).not.toBeNull();
			expect(result?.pm10).toBeNull();
			expect(result?.pm25).toBeNull();
		});

		it("API 에러 시 null을 반환해야 한다", async () => {
			// Given - API 키 설정 및 fetch 네트워크 에러
			Object.defineProperty(configService, "dataGoKrApiKey", {
				get: () => "test-api-key",
			});
			fetchSpy.mockRejectedValue(new Error("Network error"));

			// When - 대기질 조회
			const result = await provider.getAirQuality(lat, lon);

			// Then - null 반환
			expect(result).toBeNull();
		});
	});
});
