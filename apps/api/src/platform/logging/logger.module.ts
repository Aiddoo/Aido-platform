import { type DynamicModule, Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LoggerModule as PinoLoggerModule } from "nestjs-pino";

import type { EnvConfig } from "../config/index.js";
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
          inject: [ConfigService],
          useFactory: (config: ConfigService<EnvConfig, true>) =>
            createLoggerOptions(
              {
                nodeEnv: config.get("NODE_ENV", { infer: true }),
                level: config.get("LOG_LEVEL", { infer: true }),
              },
              options,
            ),
        }),
      ],
      exports: [PinoLoggerModule],
    };
  }
}
