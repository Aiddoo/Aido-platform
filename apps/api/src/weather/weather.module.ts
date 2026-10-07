import { Module } from "@nestjs/common";
import { HttpClientModule } from "@nestjs/http-client";

import { WeatherForecastAccess } from "./application/access/weather-forecast.access.js";
import { AIR_QUALITY_PROVIDER } from "./application/ports/air-quality-provider.port.js";
import { LIFESTYLE_INDEX_PROVIDER } from "./application/ports/lifestyle-index-provider.port.js";
import { SUN_TIME_PROVIDER } from "./application/ports/sun-time-provider.port.js";
import { WEATHER_CACHE } from "./application/ports/weather-cache.port.js";
import { WEATHER_LOCATION_REPOSITORY } from "./application/ports/weather-location.repository.port.js";
import { WEATHER_PROVIDER } from "./application/ports/weather-provider.port.js";
import { GetForecastsByGridBatchUseCase } from "./application/queries/get-forecasts-by-grid-batch/get-forecasts-by-grid-batch.use-case.js";
import { WeatherForecastReader } from "./application/services/weather-forecast.reader.js";
import { WEATHER_PROVIDERS } from "./application/weather.providers.js";
import { AirkoreaProvider } from "./infrastructure/adapters/airkorea.provider.js";
import { KasiSunTimeProvider } from "./infrastructure/adapters/kasi-sun-time.provider.js";
import { KmaLifestyleIndexProvider } from "./infrastructure/adapters/kma-lifestyle-index.provider.js";
import { KmaWeatherProvider } from "./infrastructure/adapters/kma-weather.provider.js";
import { WeatherCacheAdapter } from "./infrastructure/adapters/weather-cache.adapter.js";
import { PrismaWeatherLocationRepository } from "./infrastructure/persistence/prisma-weather-location.repository.js";
import { WeatherController } from "./presentation/weather.controller.js";

/**
 * 날씨 모듈 (클린아키텍처)
 *
 * 예보/부가정보 조회와 위치 등록을 담당한다. 4개 외부 기상 API(KMA·에어코리아·
 * KASI)는 각각 포트로 추상화되어 벤더 교체 시 어댑터만 바꾸면 된다. 예보 캐시-스루
 * 읽기는 WeatherForecastReader가 소유하고, 크로스 모듈(스케줄러·ai-suggestion)은
 * WeatherFacade로 배치 조회한다.
 */
@Module({
	imports: [HttpClientModule.register({ name: "weather", retry: false, throwOnHttpError: false })],
	controllers: [WeatherController],
	providers: [
		{
			provide: WeatherForecastAccess,
			inject: [GetForecastsByGridBatchUseCase],
			useFactory: (getForecastsByGridBatchUseCase: GetForecastsByGridBatchUseCase) =>
				new WeatherForecastAccess(getForecastsByGridBatchUseCase),
		},
		WeatherForecastReader,
		{
			provide: WEATHER_LOCATION_REPOSITORY,
			useClass: PrismaWeatherLocationRepository,
		},
		{ provide: WEATHER_PROVIDER, useClass: KmaWeatherProvider },
		{ provide: AIR_QUALITY_PROVIDER, useClass: AirkoreaProvider },
		{ provide: LIFESTYLE_INDEX_PROVIDER, useClass: KmaLifestyleIndexProvider },
		{ provide: SUN_TIME_PROVIDER, useClass: KasiSunTimeProvider },
		// 조회 캐시 포트 (application → CacheService/CacheKeys 직접 의존 역전)
		{ provide: WEATHER_CACHE, useClass: WeatherCacheAdapter },
		...WEATHER_PROVIDERS,
	],
	exports: [WeatherForecastAccess],
})
export class WeatherModule {}
