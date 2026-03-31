import { Module } from "@nestjs/common";
import { AIR_QUALITY_PROVIDER } from "./providers/air/air-quality.types";
import { AirkoreaProvider } from "./providers/air/airkorea.provider";
import { KmaWeatherProvider } from "./providers/kma/kma-weather.provider";
import { KmaLifestyleIndexProvider } from "./providers/lifestyle/kma-lifestyle-index.provider";
import { LIFESTYLE_INDEX_PROVIDER } from "./providers/lifestyle/lifestyle-index.types";
import { KasiSunTimeProvider } from "./providers/sun/kasi-sun-time.provider";
import { SUN_TIME_PROVIDER } from "./providers/sun/sun-time.types";
import { WEATHER_PROVIDER } from "./providers/weather-provider.interface";
import { WeatherRepository } from "./repositories/weather.repository";
import { WeatherService } from "./services/weather.service";
import { WeatherController } from "./weather.controller";

@Module({
	controllers: [WeatherController],
	providers: [
		WeatherService,
		WeatherRepository,
		{
			provide: WEATHER_PROVIDER,
			useClass: KmaWeatherProvider,
		},
		{
			provide: AIR_QUALITY_PROVIDER,
			useClass: AirkoreaProvider,
		},
		{
			provide: LIFESTYLE_INDEX_PROVIDER,
			useClass: KmaLifestyleIndexProvider,
		},
		{
			provide: SUN_TIME_PROVIDER,
			useClass: KasiSunTimeProvider,
		},
	],
	exports: [
		WeatherService,
		WEATHER_PROVIDER,
		AIR_QUALITY_PROVIDER,
		LIFESTYLE_INDEX_PROVIDER,
		SUN_TIME_PROVIDER,
	],
})
export class WeatherModule {}
