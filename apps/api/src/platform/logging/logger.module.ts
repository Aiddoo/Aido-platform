import { type DynamicModule, Global, Module } from "@nestjs/common";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";

import { TypedConfigService } from "../config/services/config.service.js";
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
          inject: [TypedConfigService],
          useFactory: (config: TypedConfigService) =>
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
