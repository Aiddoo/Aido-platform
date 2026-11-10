import type { Provider } from "@nestjs/common";

import { provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { ForecastGridCacheInvalidatorPort } from "./application/ports/forecast-grid-cache-invalidator.port.js";
import { TimezoneResolverPort } from "./application/ports/timezone-resolver.port.js";
import { UserLocationRepositoryPort } from "./application/ports/user-location.repository.port.js";
import { WeatherGridResolverPort } from "./application/ports/weather-grid-resolver.port.js";
import { UpsertUserLocationUseCase } from "./application/use-cases/upsert-user-location.use-case.js";
import { ForecastGridCacheInvalidatorAdapter } from "./infrastructure/adapters/forecast-grid-cache-invalidator.adapter.js";
import { KmaWeatherGridResolverAdapter } from "./infrastructure/adapters/kma-weather-grid-resolver.adapter.js";
import { TzLookupTimezoneResolverAdapter } from "./infrastructure/adapters/tz-lookup-timezone-resolver.adapter.js";
import { DrizzleUserLocationRepository } from "./infrastructure/persistence/drizzle-user-location.repository.js";

export const WEATHER_LOCATIONS_PROVIDERS = [
  { provide: UserLocationRepositoryPort, useClass: DrizzleUserLocationRepository },
  { provide: WeatherGridResolverPort, useClass: KmaWeatherGridResolverAdapter },
  { provide: TimezoneResolverPort, useClass: TzLookupTimezoneResolverAdapter },
  { provide: ForecastGridCacheInvalidatorPort, useClass: ForecastGridCacheInvalidatorAdapter },
  provideUseCase(UpsertUserLocationUseCase, {
    userLocationRepository: UserLocationRepositoryPort,
    gridCacheInvalidator: ForecastGridCacheInvalidatorPort,
    weatherGridResolver: WeatherGridResolverPort,
    timezoneResolver: TimezoneResolverPort,
    clock: ClockPort,
  }),
] satisfies Provider[];
