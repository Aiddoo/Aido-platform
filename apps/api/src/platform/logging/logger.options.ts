import type { Request, Response } from "express";
import type { Params } from "nestjs-pino";

import { LOGGER_REDACT_PATHS } from "./constants/logger.constant.js";
import { HttpLogEvent, httpRequestPath } from "./http-log.js";
import type { LoggerModuleOptions } from "./interfaces/logger.interface.js";

function getDefaultLogLevel(nodeEnv: string): string {
  switch (nodeEnv) {
    case "test":
      return "silent";
    case "production":
      return "info";
    default:
      return "debug";
  }
}

export function createLoggerOptions(
  config: Readonly<{ nodeEnv: string; level: string | undefined }>,
  options: LoggerModuleOptions = {},
) {
  const isTest = config.nodeEnv === "test";
  const level = options.level ?? config.level ?? getDefaultLogLevel(config.nodeEnv);
  const prettyPrint = options.prettyPrint ?? (config.nodeEnv !== "production" && !isTest);
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
