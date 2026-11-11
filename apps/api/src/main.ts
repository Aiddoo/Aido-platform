import type { ConfigType } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";

import { appConfig } from "#api/platform/config/app.config";
import { configureApplication } from "#api/platform/http/configure-application";
import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";
import { flushExceptionReports } from "#api/platform/observability/sentry-scope";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { setupApiDocs } from "./api-docs.js";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const { port, corsOrigins } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  app.useLogger(app.get(Logger));

  configureApplication(app, {
    corsOrigins,
    enableShutdownHooks: false,
  });
  const docsPath = setupApiDocs(app);

  await app.listen(port);

  const logger = app.get(Logger);
  logger.log({
    event: PlatformLogEvent.SERVER_STARTED,
    port,
    docsPath,
    healthPath: "/health",
  });

  // Graceful shutdown: NestJS 모듈 종료 (작업 worker 포함) → Sentry flush
  let shutdownStarted = false;
  const shutdown = async (signal: string) => {
    if (shutdownStarted) {
      return;
    }
    shutdownStarted = true;
    logger.log({ event: PlatformLogEvent.SERVER_SHUTDOWN_STARTED, signal });
    try {
      await app.close();
      process.exitCode = 0;
    } catch (error) {
      logger.error({
        event: PlatformLogEvent.SERVER_SHUTDOWN_FAILED,
        errorType: toErrorType(error),
      });
      process.exitCode = 1;
    } finally {
      await flushExceptionReports(2000);
    }
  };
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
}

await bootstrap();
