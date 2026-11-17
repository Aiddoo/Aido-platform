import { ShutdownSignal } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";

import { appConfig } from "#api/platform/config/app.config";
import { configureApplication } from "#api/platform/http/configure-application";
import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";

import { setupApiDocs } from "./api-docs.js";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const { port, corsOrigins } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  app.useLogger(app.get(Logger));

  configureApplication(app, { corsOrigins });
  // docker stop·Ctrl+C만 받는다. 끝나면 신호로 다시 죽이지 않고 exit 0으로 끝내 pino가 남은 로그를 쓴다
  app.enableShutdownHooks([ShutdownSignal.SIGTERM, ShutdownSignal.SIGINT], {
    useProcessExit: true,
  });
  const docsPath = setupApiDocs(app);

  await app.listen(port);

  app.get(Logger).log({
    event: PlatformLogEvent.SERVER_STARTED,
    port,
    docsPath,
    healthPath: "/health",
  });
}

await bootstrap();
