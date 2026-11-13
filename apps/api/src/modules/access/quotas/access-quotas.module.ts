import { Module } from "@nestjs/common";

import { AccessEntitlementsModule } from "#api/modules/access/entitlements/access-entitlements.public";
import { IdentityUserAccessModule } from "#api/modules/identity/users/identity-users.public";

import { ACCESS_QUOTAS_PROVIDERS } from "./access-quotas.providers.js";
import { QuotaLedgerPort } from "./application/ports/quota-ledger.port.js";
import { QuotaUsageRepositoryPort } from "./application/ports/quota-usage.repository.port.js";
import { CheckQuotaRemainingUseCase } from "./application/use-cases/check-quota-remaining.use-case.js";

// 원장은 같은 Context의 권한 판단을 쓰므로 권한 모듈을 다시 내보내 소비 Context가 한 번에 받는다
@Module({
  imports: [AccessEntitlementsModule, IdentityUserAccessModule],
  providers: [...ACCESS_QUOTAS_PROVIDERS],
  exports: [
    AccessEntitlementsModule,
    QuotaLedgerPort,
    // 권한 현황(entitlement-usage)이 같은 기간의 계량기 사용량을 읽는다
    QuotaUsageRepositoryPort,
    // @RequireQuota 가드가 붙은 라우트의 모듈이 이 UseCase로 남은 횟수를 확인한다
    CheckQuotaRemainingUseCase,
  ],
})
export class AccessQuotasModule {}
