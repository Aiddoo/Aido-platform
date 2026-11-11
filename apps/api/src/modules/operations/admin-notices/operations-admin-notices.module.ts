import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HttpClientModule } from "@nestjs/http-client";

import { DatabaseModule } from "#api/platform/database/database.module";

import { AdminEventNotifierPort } from "./application/ports/admin-event-notifier.port.js";
import { operationsAdminNoticesConfig } from "./operations-admin-notices.config.js";
import {
  DISCORD_HTTP_CLIENT_NAME,
  OPERATIONS_ADMIN_NOTICES_PROVIDERS,
} from "./operations-admin-notices.providers.js";

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forFeature(operationsAdminNoticesConfig),
    HttpClientModule.register({
      name: DISCORD_HTTP_CLIENT_NAME,
      retry: false,
      throwOnHttpError: false,
    }),
  ],
  providers: [...OPERATIONS_ADMIN_NOTICES_PROVIDERS],
  exports: [AdminEventNotifierPort],
})
export class OperationsAdminNoticesModule {}
