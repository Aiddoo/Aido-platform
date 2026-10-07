import { type FactoryProvider } from "@nestjs/common";

import { ENTITLEMENT_CACHE } from "./application/ports/entitlement/entitlement-cache.port.js";
import { ENTITLEMENT_DATABASE } from "./application/ports/entitlement/entitlement-state.port.js";
import { EntitlementService } from "./application/services/entitlement/entitlement.service.js";

export const entitlementServiceProvider: FactoryProvider<EntitlementService> = {
  provide: EntitlementService,
  inject: [ENTITLEMENT_CACHE, ENTITLEMENT_DATABASE],
  useFactory: (
    cacheService: ConstructorParameters<typeof EntitlementService>[0]["cacheService"],
    database: ConstructorParameters<typeof EntitlementService>[0]["database"],
  ) => new EntitlementService({ cacheService, database }),
};
