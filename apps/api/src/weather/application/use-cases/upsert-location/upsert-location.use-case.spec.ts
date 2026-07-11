/**
 * UpsertLocationUseCase 단위 테스트
 *
 * 저장소 포트/캐시를 스텁으로 대체해 격자 변경 시 구 격자 캐시 무효화 동작만
 * 검증한다 (SOLID/DIP). 실제 DB·Redis는 통합/E2E에서 담당한다.
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { UserLocation } from "../../../domain/entities/user-location.entity";
import {
	WEATHER_LOCATION_REPOSITORY,
	type WeatherLocationRepositoryPort,
} from "../../ports/weather-location.repository.port";
import { UpsertLocationUseCase } from "./upsert-location.use-case";

function reconstitute(
	userId: string,
	latitude: number,
	longitude: number,
	gridX: number,
	gridY: number,
): UserLocation {
	return UserLocation.reconstitute({
		userId,
		latitude,
		longitude,
		gridX,
		gridY,
	});
}

describe("UpsertLocationUseCase — 위치 등록/수정 use-case", () => {
	let useCase: UpsertLocationUseCase;
	let repository: Mocked<WeatherLocationRepositoryPort>;
	let cache: Mocked<CacheService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			UpsertLocationUseCase,
		).compile();

		useCase = unit;
		repository = unitRef.get(WEATHER_LOCATION_REPOSITORY);
		cache = unitRef.get(CacheService);
	});

	it("좌표 불변식을 검증하고 저장 결과를 반환한다", async () => {
		// Given
		const saved = reconstitute("user-1", 37.5665, 126.978, 60, 127);
		repository.findByUserId.mockResolvedValue(null);
		repository.upsert.mockResolvedValue(saved);

		// When
		const result = await useCase.execute({
			userId: "user-1",
			latitude: 37.5665,
			longitude: 126.978,
		});

		// Then
		expect(result).toBe(saved);
		expect(repository.upsert).toHaveBeenCalledTimes(1);
		expect(cache.delByPattern).not.toHaveBeenCalled();
	});

	it("기존 위치가 없으면 캐시를 무효화하지 않는다", async () => {
		// Given
		const saved = reconstitute("user-1", 37.5665, 126.978, 60, 127);
		repository.findByUserId.mockResolvedValue(null);
		repository.upsert.mockResolvedValue(saved);

		// When
		await useCase.execute({
			userId: "user-1",
			latitude: 37.5665,
			longitude: 126.978,
		});

		// Then
		expect(cache.delByPattern).not.toHaveBeenCalled();
		expect(cache.del).not.toHaveBeenCalled();
	});

	it("격자가 동일하면 캐시를 무효화하지 않는다", async () => {
		// Given
		const old = reconstitute("user-1", 37.5665, 126.978, 60, 127);
		const saved = reconstitute("user-1", 37.5665, 126.978, 60, 127);
		repository.findByUserId.mockResolvedValue(old);
		repository.upsert.mockResolvedValue(saved);

		// When
		await useCase.execute({
			userId: "user-1",
			latitude: 37.5665,
			longitude: 126.978,
		});

		// Then
		expect(cache.delByPattern).not.toHaveBeenCalled();
		expect(cache.del).not.toHaveBeenCalled();
	});

	it("격자가 변경되면 구 격자 캐시를 무효화한다", async () => {
		// Given
		const old = reconstitute("user-1", 35.1796, 129.0756, 98, 76);
		const saved = reconstitute("user-1", 37.5665, 126.978, 60, 127);
		repository.findByUserId.mockResolvedValue(old);
		repository.upsert.mockResolvedValue(saved);

		// When
		await useCase.execute({
			userId: "user-1",
			latitude: 37.5665,
			longitude: 126.978,
		});

		// Then - 구 격자(98:76) 기준으로 패턴/latest/conditions 캐시 삭제
		expect(cache.delByPattern).toHaveBeenCalledTimes(1);
		expect(cache.del).toHaveBeenCalledTimes(2);
	});
});
