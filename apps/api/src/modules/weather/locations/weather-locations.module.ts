import { Module } from "@nestjs/common";

import { TimezoneResolverPort } from "./application/ports/timezone-resolver.port.js";
import { UserLocationRepositoryPort } from "./application/ports/user-location.repository.port.js";
import { WeatherLocationController } from "./presentation/http/v1/weather-location.controller.js";
import { WeatherLocationV2Controller } from "./presentation/http/v2/weather-location.controller.js";
import { WEATHER_LOCATIONS_PROVIDERS } from "./weather-locations.providers.js";

@Module({
  controllers: [WeatherLocationController, WeatherLocationV2Controller],
  providers: [...WEATHER_LOCATIONS_PROVIDERS],
  exports: [UserLocationRepositoryPort, TimezoneResolverPort],
})
export class WeatherLocationsModule {}
