import { Inject } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { CacheService } from "@/shared/infrastructure/cache/cache.service";
import { CacheKeys } from "@/shared/infrastructure/cache/constants/cache-keys";
import { UserLocation } from "../../../domain/entities/user-location.entity";
import { Coordinate } from "../../../domain/value-objects/coordinate.vo";
import {
	WEATHER_LOCATION_REPOSITORY,
	type WeatherLocationRepositoryPort,
} from "../../ports/weather-location.repository.port";
import { UpsertLocationCommand } from "./upsert-location.command";

@CommandHandler(UpsertLocationCommand)
export class UpsertLocationHandler
	implements ICommandHandler<UpsertLocationCommand, UserLocation>
{
	constructor(
		@Inject(WEATHER_LOCATION_REPOSITORY)
		private readonly repository: WeatherLocationRepositoryPort,
		private readonly cacheService: CacheService,
	) {}

	async execute(command: UpsertLocationCommand): Promise<UserLocation> {
		// 좌표 불변식 검증 + 격자 파생은 도메인이 소유
		const location = UserLocation.create(
			command.userId,
			Coordinate.of(command.latitude, command.longitude),
		);

		const oldLocation = await this.repository.findByUserId(command.userId);
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
