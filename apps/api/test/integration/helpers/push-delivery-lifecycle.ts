import type { TransactionHost } from "@nestjs-cls/transactional";

import { DrizzlePushDeliveryClaimRepository } from "#api/modules/notification/push-dispatches/infrastructure/persistence/drizzle-push-delivery-claim.repository";
import { DrizzlePushDeliveryFinalizationRepository } from "#api/modules/notification/push-dispatches/infrastructure/persistence/drizzle-push-delivery-finalization.repository";
import { DrizzlePushDeliveryLeaseRepository } from "#api/modules/notification/push-dispatches/infrastructure/persistence/drizzle-push-delivery-lease.repository";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import type { ClockPort } from "#api/shared/application/ports/clock.port";

// 발송 단계 저장소 셋(claim·마무리·lease)을 한 객체로 묶어 단계를 이어 부르는 통합 테스트가 쓴다
export function createPushDeliveryLifecycle(
  transactionHost: TransactionHost<DrizzleTransactionalAdapter>,
  clock: ClockPort,
) {
  const claims = new DrizzlePushDeliveryClaimRepository(transactionHost, clock);
  const finalization = new DrizzlePushDeliveryFinalizationRepository(transactionHost, clock);
  const lease = new DrizzlePushDeliveryLeaseRepository(transactionHost, clock);
  return {
    claim: claims.claim.bind(claims),
    markRateLimitReserved: claims.markRateLimitReserved.bind(claims),
    reopenAfterFinalClaimFailure: claims.reopenAfterFinalClaimFailure.bind(claims),
    reopenFailedPublications: claims.reopenFailedPublications.bind(claims),
    finalizeSkipped: finalization.finalizeSkipped.bind(finalization),
    finalizeResults: finalization.finalizeResults.bind(finalization),
    release: lease.release.bind(lease),
    recoverStaleProcessing: lease.recoverStaleProcessing.bind(lease),
  };
}
