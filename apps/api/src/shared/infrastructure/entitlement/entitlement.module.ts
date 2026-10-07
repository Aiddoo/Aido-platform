import { Global, Module } from "@nestjs/common";

import {
  ENTITLEMENT_CACHE,
  ENTITLEMENT_DATABASE,
} from "../../application/entitlement/entitlement-state.port.js";
import { EntitlementService } from "../../application/entitlement/entitlement.service.js";
import { CacheService } from "../cache/cache.service.js";
import { PrismaEntitlementReader } from "./prisma-entitlement.reader.js";

@Global()
@Module({
  providers: [
    EntitlementService,
    PrismaEntitlementReader,
    { provide: ENTITLEMENT_CACHE, useExisting: CacheService },
    { provide: ENTITLEMENT_DATABASE, useExisting: PrismaEntitlementReader },
  ],
  exports: [EntitlementService],
})
export class EntitlementModule {}
