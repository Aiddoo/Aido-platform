import { type FactoryProvider } from "@nestjs/common";

import {
  ENTITLEMENT_CACHE,
  ENTITLEMENT_DATABASE,
} from "./application/services/entitlement/entitlement-state.port.js";
import { EntitlementService } from "./application/services/entitlement/entitlement.service.js";

export const entitlementServiceProvider: FactoryProvider<EntitlementService> = {
  provide: EntitlementService,
  inject: [ENTITLEMENT_CACHE, ENTITLEMENT_DATABASE],
  useFactory: (
    cacheService: ConstructorParameters<typeof EntitlementService>[0]["cacheService"],
    database: ConstructorParameters<typeof EntitlementService>[0]["database"],
  ) => new EntitlementService({ cacheService, database }),
};
