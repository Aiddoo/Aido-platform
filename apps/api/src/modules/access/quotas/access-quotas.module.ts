import { Module } from "@nestjs/common";

import {
  IdentityUserAccessModule,
  USER_MUTATION_LOCK,
} from "#api/modules/identity/identity-user-access.public";

import { AccessEntitlementsModule } from "../entitlements/access-entitlements.module.js";
import { quotaLedgerAdapterProvider } from "./access-quotas.providers.js";
import { QUOTA_LEDGER } from "./application/ports/quota-ledger.port.js";
import { QUOTA_LEDGER_REPOSITORY } from "./application/ports/quota-ledger.repository.port.js";
import { QUOTA_USER_MUTATION_LOCK } from "./application/ports/quota-user-mutation-lock.port.js";
import { QuotaLedgerAdapter } from "./infrastructure/adapters/quota-ledger.adapter.js";
import { QuotaAbandonedRefundProcessor } from "./infrastructure/jobs/quota-abandoned-refund.processor.js";
import { DrizzleQuotaLedgerRepository } from "./infrastructure/persistence/drizzle-quota-ledger.repository.js";

// 원장은 같은 Context의 권한 판단을 쓰므로 권한 모듈을 다시 내보내 소비 Context가 한 번에 받는다
@Module({
  imports: [AccessEntitlementsModule, IdentityUserAccessModule],
  providers: [
    quotaLedgerAdapterProvider,
    QuotaAbandonedRefundProcessor,
    { provide: QUOTA_LEDGER, useExisting: QuotaLedgerAdapter },
    { provide: QUOTA_LEDGER_REPOSITORY, useClass: DrizzleQuotaLedgerRepository },
    { provide: QUOTA_USER_MUTATION_LOCK, useExisting: USER_MUTATION_LOCK },
  ],
  exports: [AccessEntitlementsModule, QUOTA_LEDGER],
})
export class AccessQuotasModule {}
