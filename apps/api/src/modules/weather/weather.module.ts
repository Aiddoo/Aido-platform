import { Module } from "@nestjs/common";

import { WeatherUserLocationsModule } from "./user-locations/weather-user-locations.module.js";
import { WeatherWeatherReportsModule } from "./weather-reports/weather-weather-reports.module.js";

@Module({
  imports: [WeatherUserLocationsModule, WeatherWeatherReportsModule],
  exports: [WeatherWeatherReportsModule],
})
export class WeatherModule {}
