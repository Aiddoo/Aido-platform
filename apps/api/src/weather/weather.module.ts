import { Module } from "@nestjs/common";
import { WeatherFacade } from "./application/facades/weather.facade";
import { AIR_QUALITY_PROVIDER } from "./application/ports/air-quality-provider.port";
import { LIFESTYLE_INDEX_PROVIDER } from "./application/ports/lifestyle-index-provider.port";
import { SUN_TIME_PROVIDER } from "./application/ports/sun-time-provider.port";
import { WEATHER_LOCATION_REPOSITORY } from "./application/ports/weather-location.repository.port";
import { WEATHER_PROVIDER } from "./application/ports/weather-provider.port";
import { WeatherQueryUseCases } from "./application/queries";
import { WeatherForecastReader } from "./application/services/weather-forecast.reader";
import { WeatherUseCases } from "./application/use-cases";
import { AirkoreaProvider } from "./infrastructure/adapters/airkorea.provider";
import { KasiSunTimeProvider } from "./infrastructure/adapters/kasi-sun-time.provider";
import { KmaLifestyleIndexProvider } from "./infrastructure/adapters/kma-lifestyle-index.provider";
import { KmaWeatherProvider } from "./infrastructure/adapters/kma-weather.provider";
import { PrismaWeatherLocationRepository } from "./infrastructure/persistence/prisma-weather-location.repository";
import { WeatherController } from "./presentation/weather.controller";

/**
 * 날씨 모듈 (클린아키텍처)
 *
 * 예보/부가정보 조회와 위치 등록을 담당한다. 4개 외부 기상 API(KMA·에어코리아·
 * KASI)는 각각 포트로 추상화되어 벤더 교체 시 어댑터만 바꾸면 된다. 예보 캐시-스루
 * 읽기는 WeatherForecastReader가 소유하고, 크로스 모듈(스케줄러·ai-suggestion)은
 * WeatherFacade로 배치 조회한다.
 */
@Module({
	controllers: [WeatherController],
	providers: [
		WeatherFacade,
		WeatherForecastReader,
		{
			provide: WEATHER_LOCATION_REPOSITORY,
			useClass: PrismaWeatherLocationRepository,
		},
		{ provide: WEATHER_PROVIDER, useClass: KmaWeatherProvider },
		{ provide: AIR_QUALITY_PROVIDER, useClass: AirkoreaProvider },
		{ provide: LIFESTYLE_INDEX_PROVIDER, useClass: KmaLifestyleIndexProvider },
		{ provide: SUN_TIME_PROVIDER, useClass: KasiSunTimeProvider },
		...WeatherQueryUseCases,
		...WeatherUseCases,
	],
	exports: [WeatherFacade],
})
export class WeatherModule {}
