import type { Request, Response } from "express";
import type { Params } from "nestjs-pino";

import type { NodeEnvironment } from "#api/platform/config/schemas/app.schema";
import { assignRequestId } from "#api/platform/http/request-client/request-id";

import { LOGGER_REDACT_PATHS } from "./constants/logger.constant.js";
import { HttpLogEvent, httpRequestPath } from "./http-log.js";
import type { LoggerModuleOptions } from "./interfaces/logger.interface.js";

const LOG_FORMATS = ["json", "pretty"] as const;
type LogFormat = (typeof LOG_FORMATS)[number];

// 형식·기본 레벨은 배포 환경이 아니라 실행 방식을 따른다. pino-pretty는 devDependency라 production 빌드(개발서버 포함)에 없다
const DEFAULT_LOG_FORMAT = {
  development: "pretty",
  test: "json",
  production: "json",
} as const satisfies Record<NodeEnvironment, LogFormat>;

const DEFAULT_LOG_LEVEL = {
  development: "debug",
  test: "silent",
  production: "info",
} as const satisfies Record<NodeEnvironment, string>;

export function createLoggerOptions(
  config: Readonly<{ nodeEnv: NodeEnvironment; level: string | undefined }>,
  options: LoggerModuleOptions = {},
) {
  const isTest = config.nodeEnv === "test";
  const level = options.level ?? config.level ?? DEFAULT_LOG_LEVEL[config.nodeEnv];
  const prettyPrint = options.prettyPrint ?? DEFAULT_LOG_FORMAT[config.nodeEnv] === "pretty";
  const autoLogging = options.autoLogging ?? !isTest;
  const redactPaths = options.redactPaths ?? [...LOGGER_REDACT_PATHS];

  return {
    pinoHttp: {
      transport: prettyPrint
        ? {
            target: "pino-pretty",
            options: {
              colorize: true,
              customColors: "warn:red",
              translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l",
            },
          }
        : undefined,
      level,
      autoLogging,
      genReqId: assignRequestId,
      customLogLevel: (_req, res) => (res.statusCode >= 400 ? "silent" : "info"),
      quietReqLogger: true,
      quietResLogger: true,
      redact: redactPaths,
      serializers: {
        req: () => undefined,
        res: () => undefined,
      },
      customSuccessObject: (req, res, loggableObject) => ({
        ...loggableObject,
        event: HttpLogEvent.REQUEST_COMPLETED,
        method: req.method,
        path: httpRequestPath(req.url),
        statusCode: res.statusCode,
        userId: req.user?.userId,
      }),
      customSuccessMessage: () => "HTTP 요청 완료",
    },
  } satisfies Params<Request & { user?: { userId?: string } }, Response>;
}
