import { Module } from "@nestjs/common";

import { TimezoneResolverPort } from "./application/ports/timezone-resolver.port.js";
import { UserLocationRepositoryPort } from "./application/ports/user-location.repository.port.js";
import { LocationController } from "./presentation/http/v1/location.controller.js";
import { WeatherLocationController } from "./presentation/http/v2/weather-location.controller.js";
import { WEATHER_USER_LOCATIONS_PROVIDERS } from "./weather-user-locations.providers.js";

@Module({
  controllers: [LocationController, WeatherLocationController],
  providers: [...WEATHER_USER_LOCATIONS_PROVIDERS],
  exports: [UserLocationRepositoryPort, TimezoneResolverPort],
})
export class WeatherUserLocationsModule {}
