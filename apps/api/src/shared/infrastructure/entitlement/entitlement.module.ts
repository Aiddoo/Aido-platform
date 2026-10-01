import { Global, Module } from "@nestjs/common";

import {
	ENTITLEMENT_CACHE,
	ENTITLEMENT_DATABASE,
} from "../../application/entitlement/entitlement-state.port.js";
import { EntitlementService } from "../../application/entitlement/entitlement.service.js";
import { CacheService } from "../cache/cache.service.js";
import { DatabaseService } from "../database/database.service.js";

@Global()
@Module({
	providers: [
		EntitlementService,
		{ provide: ENTITLEMENT_CACHE, useExisting: CacheService },
		{ provide: ENTITLEMENT_DATABASE, useExisting: DatabaseService },
	],
	exports: [EntitlementService],
})
export class EntitlementModule {}
