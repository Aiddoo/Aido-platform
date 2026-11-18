import { type INestApplication, ShutdownSignal } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";

import { appConfig } from "#api/platform/config/app.config";
import { configureApplication } from "#api/platform/http/configure-application";
import { createHttpAdapter } from "#api/platform/http/http-adapter";
import { PlatformLogEvent } from "#api/platform/logging/platform.log-events";
import { flushExceptionReports } from "#api/platform/observability/sentry-scope";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { setupApiDocs } from "./api-docs.js";
import { AppModule } from "./app.module.js";

// 이 안에 못 보낸 이벤트는 버린다. 종료 유예(compose stop_grace_period) 안에서 끝나야 한다
const EXCEPTION_REPORT_FLUSH_TIMEOUT_MS = 2000;

// enableShutdownHooks는 HTTP 서버 닫기가 실패하면 뒤 hook을 건너뛰고 키 없는 로그로 끝나, 직접 받아 flush를 늘 돌린다
function closeOnShutdownSignals(app: INestApplication, logger: Logger): void {
  let closing = false;
  const close = async (signal: ShutdownSignal) => {
    if (closing) {
      return;
    }
    closing = true;
    // 작업 worker 정지(최대 90초)를 기다리기 전에 남긴다
    logger.log({ event: PlatformLogEvent.SERVER_SHUTDOWN_STARTED, signal });
    let exitCode = 0;
    try {
      await app.close();
    } catch (error) {
      exitCode = 1;
      logger.error({
        event: PlatformLogEvent.SERVER_SHUTDOWN_FAILED,
        signal,
        errorType: toErrorType(error),
      });
    } finally {
      await flushExceptionReports(EXCEPTION_REPORT_FLUSH_TIMEOUT_MS);
    }
    // 신호로 다시 죽이지 않고 exit로 끝내 pino가 남은 로그를 쓴다
    process.exit(exitCode);
  };
  for (const signal of [ShutdownSignal.SIGTERM, ShutdownSignal.SIGINT]) {
    process.on(signal, () => {
      void close(signal);
    });
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, createHttpAdapter(), { bufferLogs: true });

  const { port, corsOrigins } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  const logger = app.get(Logger);
  app.useLogger(logger);

  configureApplication(app, { corsOrigins });
  closeOnShutdownSignals(app, logger);
  const docsPath = setupApiDocs(app);

  await app.listen(port);

  logger.log({
    event: PlatformLogEvent.SERVER_STARTED,
    port,
    docsPath,
    healthPath: "/health",
  });
}

await bootstrap();
