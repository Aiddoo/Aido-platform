import {
  BadRequestException,
  type INestApplication,
  StandardSchemaValidationPipe,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import helmet from "helmet";

import { appConfig, type AppSettings } from "#api/platform/config/app.config";
import { createCorsOptions } from "#api/platform/config/utils/cors-options";

import { API_VERSIONING_OPTIONS } from "./api-versioning.js";
import { configureRequestIdentity } from "./configure-request-identity.js";
import { ResponseContractInterceptor } from "./interceptors/response-contract.interceptor.js";
import { configureRouteBodyLimits } from "./route-body-limits.js";

export interface ApplicationConfiguration {
  corsOrigins: readonly string[];
  enableShutdownHooks?: boolean;
}

/**
 * 운영 서버와 HTTP E2E가 공유하는 애플리케이션 경계 설정. 개발 도구 스위치는 앱이 받은 app 설정에서 읽는다.
 *
 * 필터와 인터셉터는 AppModule의 APP_FILTER/APP_INTERCEPTOR provider로 등록되므로
 * 여기서 중복 등록하지 않는다. 응답 계약 검사만 운영이 아닐 때 여기서 더한다.
 */
export function configureApplication(
  app: INestApplication,
  config: ApplicationConfiguration,
): void {
  const { devTools, responseContractCheck } = app.get<AppSettings>(appConfig.KEY);
  configureRequestIdentity(app);
  app.use(helmet());
  app.enableCors(
    createCorsOptions({
      corsOrigins: config.corsOrigins,
      localCorsOrigins: devTools.localCorsOrigins,
    }),
  );
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
  if (responseContractCheck) {
    app.useGlobalInterceptors(new ResponseContractInterceptor(app.get(Reflector)));
  }

  if (config.enableShutdownHooks !== false) {
    app.enableShutdownHooks();
  }
}
