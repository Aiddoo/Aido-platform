import type { ConfigType } from "@nestjs/config";

import { defineConfig } from "#api/platform/config/define-config";
import { externalSchema } from "#api/platform/config/schemas/external.schema";

/**
 * 날씨 공급자 자격. KMA_API_KEY는 기상청·천문연구원·에어코리아가 공유하는 공공데이터포털 서비스키다.
 * WeatherKit 네 값은 모두 있을 때만 자격이 되고(시작 검증이 all-or-none을 보장한다), 없으면 null이다.
 */
export const weatherForecastsConfig = defineConfig(
  "weatherForecasts",
  externalSchema
    .pick({
      KMA_API_KEY: true,
      WEATHERKIT_TEAM_ID: true,
      WEATHERKIT_KEY_ID: true,
      WEATHERKIT_SERVICE_ID: true,
      WEATHERKIT_PRIVATE_KEY: true,
    })
    .transform((env) => {
      const { WEATHERKIT_TEAM_ID, WEATHERKIT_KEY_ID, WEATHERKIT_SERVICE_ID } = env;
      const { WEATHERKIT_PRIVATE_KEY } = env;
      const weatherKit =
        WEATHERKIT_TEAM_ID && WEATHERKIT_KEY_ID && WEATHERKIT_SERVICE_ID && WEATHERKIT_PRIVATE_KEY
          ? {
              teamId: WEATHERKIT_TEAM_ID,
              keyId: WEATHERKIT_KEY_ID,
              serviceId: WEATHERKIT_SERVICE_ID,
              privateKey: WEATHERKIT_PRIVATE_KEY,
            }
          : null;
      return { kmaApiKey: env.KMA_API_KEY, weatherKit };
    }),
  (env) => ({
    KMA_API_KEY: env.KMA_API_KEY,
    WEATHERKIT_TEAM_ID: env.WEATHERKIT_TEAM_ID,
    WEATHERKIT_KEY_ID: env.WEATHERKIT_KEY_ID,
    WEATHERKIT_SERVICE_ID: env.WEATHERKIT_SERVICE_ID,
    WEATHERKIT_PRIVATE_KEY: env.WEATHERKIT_PRIVATE_KEY,
  }),
);

export type WeatherForecastsConfig = ConfigType<typeof weatherForecastsConfig>;
