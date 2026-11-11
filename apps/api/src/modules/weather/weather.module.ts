import { Module } from "@nestjs/common";

import { WeatherForecastsModule } from "./forecasts/weather-forecasts.module.js";
import { WeatherLocationsModule } from "./locations/weather-locations.module.js";

@Module({
  imports: [WeatherLocationsModule, WeatherForecastsModule],
  exports: [WeatherForecastsModule],
})
export class WeatherModule {}
