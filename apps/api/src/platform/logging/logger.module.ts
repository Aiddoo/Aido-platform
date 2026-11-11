import { type DynamicModule, Global, Module } from "@nestjs/common";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";

import { appConfig, type AppSettings } from "../config/app.config.js";
import type { LoggerModuleOptions } from "./interfaces/logger.interface.js";
import { createLoggerOptions } from "./logger.options.js";

@Global()
@Module({})
export class LoggerModule {
  static forRootAsync(options: LoggerModuleOptions = {}): DynamicModule {
    return {
      module: LoggerModule,
      imports: [
        PinoLoggerModule.forRootAsync({
          inject: [appConfig.KEY],
          useFactory: (app: AppSettings) =>
            createLoggerOptions({ nodeEnv: app.nodeEnv, level: app.logLevel }, options),
        }),
      ],
      exports: [PinoLoggerModule],
    };
  }
}
