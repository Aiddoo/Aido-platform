import { Inject, Injectable } from "@nestjs/common";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { CacheKeys } from "@/shared/infrastructure/cache/constants/cache-keys";
import { UserLocation } from "../../../domain/entities/user-location.entity";
import { Coordinate } from "../../../domain/value-objects/coordinate.vo";
import {
	WEATHER_LOCATION_REPOSITORY,
	type WeatherLocationRepositoryPort,
} from "../../ports/weather-location.repository.port";

/**
 * 사용자 위치 등록/수정 입력. 좌표로부터 격자를 파생해 저장하고, 격자가 바뀌면
 * 이전 격자의 캐시를 무효화한다.
 */
export interface UpsertLocationInput {
	userId: string;
	latitude: number;
	longitude: number;
}

@Injectable()
export class UpsertLocationUseCase {
	constructor(
		@Inject(WEATHER_LOCATION_REPOSITORY)
		private readonly repository: WeatherLocationRepositoryPort,
		private readonly cacheService: CacheService,
	) {}

	async execute(input: UpsertLocationInput): Promise<UserLocation> {
		// 좌표 불변식 검증 + 격자 파생은 도메인이 소유
		const location = UserLocation.create(
			input.userId,
			Coordinate.of(input.latitude, input.longitude),
		);

		const oldLocation = await this.repository.findByUserId(input.userId);
		const saved = await this.repository.upsert(location);

		// 격자가 변경되면 구 격자의 캐시 무효화
		if (oldLocation && !oldLocation.grid.equals(saved.grid)) {
			await Promise.all([
				this.cacheService.delByPattern(
					CacheKeys.weatherForecastPattern(
						oldLocation.gridX,
						oldLocation.gridY,
					),
				),
				this.cacheService.del(
					CacheKeys.weatherForecastLatest(oldLocation.gridX, oldLocation.gridY),
				),
				this.cacheService.del(
					CacheKeys.weatherConditions(oldLocation.gridX, oldLocation.gridY),
				),
			]);
		}

		return saved;
	}
}
