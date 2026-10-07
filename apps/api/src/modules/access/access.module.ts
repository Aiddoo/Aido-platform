import { Global, Module } from "@nestjs/common";

import { entitlementServiceProvider } from "./access-entitlement-application.providers.js";
import {
  ENTITLEMENT_CACHE,
  ENTITLEMENT_DATABASE,
} from "./application/services/entitlement/entitlement-state.port.js";
import { EntitlementService } from "./application/services/entitlement/entitlement.service.js";
import { EntitlementCacheAdapter } from "./infrastructure/adapters/entitlement/entitlement-cache.adapter.js";
import { PrismaEntitlementReader } from "./infrastructure/persistence/entitlement/prisma-entitlement.reader.js";

@Global()
@Module({
  providers: [
    entitlementServiceProvider,
    PrismaEntitlementReader,
    EntitlementCacheAdapter,
    { provide: ENTITLEMENT_CACHE, useExisting: EntitlementCacheAdapter },
    { provide: ENTITLEMENT_DATABASE, useExisting: PrismaEntitlementReader },
  ],
  exports: [EntitlementService],
})
export class EntitlementModule {}
