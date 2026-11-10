import { Module } from "@nestjs/common";

import { IdentityUserAccessModule } from "#api/modules/identity/users/identity-users.public";

import { AccessEntitlementsModule } from "../entitlements/access-entitlements.module.js";
import { ACCESS_QUOTAS_PROVIDERS } from "./access-quotas.providers.js";
import { QUOTA_LEDGER, QuotaLedgerPort } from "./application/ports/quota-ledger.port.js";
import { QuotaUsageRepositoryPort } from "./application/ports/quota-usage.repository.port.js";

// 원장은 같은 Context의 권한 판단을 쓰므로 권한 모듈을 다시 내보내 소비 Context가 한 번에 받는다
@Module({
  imports: [AccessEntitlementsModule, IdentityUserAccessModule],
  providers: [...ACCESS_QUOTAS_PROVIDERS],
  exports: [
    AccessEntitlementsModule,
    QuotaLedgerPort,
    QUOTA_LEDGER,
    // 권한 스냅샷이 같은 기간의 계량기 사용량을 읽는다
    QuotaUsageRepositoryPort,
  ],
})
export class AccessQuotasModule {}
