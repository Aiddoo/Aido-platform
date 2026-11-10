import { type DynamicModule, Global, Module } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";

import { appConfig } from "../config/app.config.js";
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
          useFactory: (config: ConfigType<typeof appConfig>) =>
            createLoggerOptions(
              {
                nodeEnv: config.nodeEnv,
                level: config.logLevel,
              },
              options,
            ),
        }),
      ],
      exports: [PinoLoggerModule],
    };
  }
}
