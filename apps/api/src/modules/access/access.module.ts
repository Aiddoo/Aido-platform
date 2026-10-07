import { Global, Module } from "@nestjs/common";

import { CacheService } from "../../platform/cache/cache.service.js";
import { entitlementServiceProvider } from "./access-entitlement-application.providers.js";
import {
  ENTITLEMENT_CACHE,
  ENTITLEMENT_DATABASE,
} from "./application/services/entitlement/entitlement-state.port.js";
import { EntitlementService } from "./application/services/entitlement/entitlement.service.js";
import { PrismaEntitlementReader } from "./infrastructure/persistence/entitlement/prisma-entitlement.reader.js";

@Global()
@Module({
  providers: [
    entitlementServiceProvider,
    PrismaEntitlementReader,
    { provide: ENTITLEMENT_CACHE, useExisting: CacheService },
    { provide: ENTITLEMENT_DATABASE, useExisting: PrismaEntitlementReader },
  ],
  exports: [EntitlementService],
})
export class EntitlementModule {}
