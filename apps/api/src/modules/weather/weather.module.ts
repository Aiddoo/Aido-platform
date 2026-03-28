import { Module } from "@nestjs/common";
import { KmaWeatherProvider } from "./providers/kma/kma-weather.provider";
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
	],
	exports: [WeatherService, WEATHER_PROVIDER],
})
export class WeatherModule {}
