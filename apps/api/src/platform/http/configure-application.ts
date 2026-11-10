import {
  BadRequestException,
  type INestApplication,
  StandardSchemaValidationPipe,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import helmet from "helmet";

import type { EnvConfig } from "#api/platform/config/index";
import { createCorsOptions } from "#api/platform/config/utils/cors-options";

import { API_VERSIONING_OPTIONS } from "./api-versioning.js";
import { configureRequestIdentity } from "./configure-request-identity.js";
import { ResponseContractInterceptor } from "./interceptors/response-contract.interceptor.js";
import { configureRouteBodyLimits } from "./route-body-limits.js";

export interface ApplicationConfiguration {
  nodeEnv: EnvConfig["NODE_ENV"];
  corsOrigins: string[];
  enableShutdownHooks?: boolean;
}

/**
 * 운영 서버와 HTTP E2E가 공유하는 애플리케이션 경계 설정.
 *
 * 필터와 인터셉터는 AppModule의 APP_FILTER/APP_INTERCEPTOR provider로 등록되므로
 * 여기서 중복 등록하지 않는다. 응답 계약 검사만 운영이 아닐 때 여기서 더한다.
 */
export function configureApplication(
  app: INestApplication,
  config: ApplicationConfiguration,
): void {
  configureRequestIdentity(app);
  app.use(helmet());
  app.enableCors(createCorsOptions(config.nodeEnv, config.corsOrigins));
  configureRouteBodyLimits(app);
  app.useGlobalPipes(
    new StandardSchemaValidationPipe({
      exceptionFactory: (issues) =>
        new BadRequestException({
          statusCode: 400,
          message: "Validation failed",
          errors: issues,
        }),
    }),
  );
  app.enableVersioning(API_VERSIONING_OPTIONS);
  // 운영은 등록하지 않아 요청마다 parse하는 비용이 없다. APP_INTERCEPTOR보다 안쪽이라 handler 반환값을 본다
  if (config.nodeEnv !== "production") {
    app.useGlobalInterceptors(new ResponseContractInterceptor(app.get(Reflector)));
  }

  if (config.enableShutdownHooks !== false) {
    app.enableShutdownHooks();
  }
}
