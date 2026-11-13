import type { Provider } from "@nestjs/common";

import { provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";

import { TimezoneResolverPort } from "./application/ports/timezone-resolver.port.js";
import { UserLocationRepositoryPort } from "./application/ports/user-location.repository.port.js";
import { WeatherGridResolverPort } from "./application/ports/weather-grid-resolver.port.js";
import { RegisterUserLocationUseCase } from "./application/use-cases/register-user-location.use-case.js";
import { KmaWeatherGridResolverAdapter } from "./infrastructure/adapters/kma-weather-grid-resolver.adapter.js";
import { TzLookupTimezoneResolverAdapter } from "./infrastructure/adapters/tz-lookup-timezone-resolver.adapter.js";
import { DrizzleUserLocationRepository } from "./infrastructure/persistence/drizzle-user-location.repository.js";

export const WEATHER_LOCATIONS_PROVIDERS = [
  { provide: UserLocationRepositoryPort, useClass: DrizzleUserLocationRepository },
  { provide: WeatherGridResolverPort, useClass: KmaWeatherGridResolverAdapter },
  { provide: TimezoneResolverPort, useClass: TzLookupTimezoneResolverAdapter },
  provideUseCase(RegisterUserLocationUseCase, {
    userLocationRepository: UserLocationRepositoryPort,
    weatherGridResolver: WeatherGridResolverPort,
    timezoneResolver: TimezoneResolverPort,
    clock: ClockPort,
  }),
] satisfies Provider[];
