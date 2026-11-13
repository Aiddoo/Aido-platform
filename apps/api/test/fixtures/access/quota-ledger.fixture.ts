import { CommitQuotaReservationUseCase } from "#api/modules/access/quotas/application/use-cases/commit-quota-reservation.use-case";
import { GetMeteredFeatureQuotaUseCase } from "#api/modules/access/quotas/application/use-cases/get-metered-feature-quota.use-case";
import { RefundAbandonedQuotaReservationsUseCase } from "#api/modules/access/quotas/application/use-cases/refund-abandoned-quota-reservations.use-case";
import { RefundQuotaReservationUseCase } from "#api/modules/access/quotas/application/use-cases/refund-quota-reservation.use-case";
import { ReopenQuotaReservationUseCase } from "#api/modules/access/quotas/application/use-cases/reopen-quota-reservation.use-case";
import { ReserveQuotaUseCase } from "#api/modules/access/quotas/application/use-cases/reserve-quota.use-case";
import { QuotaLedgerAdapter } from "#api/modules/access/quotas/infrastructure/adapters/quota-ledger.adapter";
import {
  NO_FEATURE_GRANTS,
  type FeatureGrants,
} from "#api/modules/access/shared/domain/access.constants";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import {
  InMemoryAccessStateReader,
  type InMemoryAccessUser,
} from "#test/doubles/access/in-memory-access-state.reader";
import { InMemoryQuotaChargeRepository } from "#test/doubles/access/in-memory-quota-charge.repository";
import { InMemoryQuotaUsageRepository } from "#test/doubles/access/in-memory-quota-usage.repository";
import { StubUserMutationLock } from "#test/doubles/access/stub-user-mutation-lock";
import { DateClock } from "#test/doubles/platform/date-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { SilentLogger } from "#test/doubles/platform/silent-logger";

import {
  ACCESS_FIXTURE_NOW,
  ACCESS_FIXTURE_USER_ID,
  createAccessUserFixture,
  type AccessUserInput,
} from "./access-user.fixture.js";

/** vi.setSystemTime으로 Date를 옮기는 다른 Context spec이 원장과 같은 시각을 쓰게 한다 */
export const QUOTA_LEDGER_TIME = new Date(ACCESS_FIXTURE_NOW.epochMilliseconds);

/**
 * 메모리 대역 위의 실제 원장(UseCase·QuotaLedgerAdapter). 사용 Context의 UseCase 테스트도 이 원장을 쓴다.
 * 시계를 주지 않으면 vi.setSystemTime을 따르는 DateClock이다.
 */
export function createQuotaLedgerFixture(
  input: AccessUserInput = {},
  grants: FeatureGrants = NO_FEATURE_GRANTS,
  options: { readonly clock?: ClockPort } = {},
) {
  const userId = ACCESS_FIXTURE_USER_ID;
  const users = new Map<string, InMemoryAccessUser>([[userId, createAccessUserFixture(input)]]);
  const accessStateReader = new InMemoryAccessStateReader(users);
  accessStateReader.featureGrants.seed(userId, grants);
  const quotaChargeRepository = new InMemoryQuotaChargeRepository();
  const quotaUsageRepository = new InMemoryQuotaUsageRepository(users);
  const unitOfWork = new ImmediateUnitOfWork();
  const logger = new SilentLogger();
  const alert = new RecordingOperationalAlert();
  const clock = options.clock ?? new DateClock();
  const dependencies = {
    unitOfWork,
    userMutationLock: new StubUserMutationLock(users),
    accessStateReader,
    quotaChargeRepository,
    quotaUsageRepository,
    clock,
    logger,
  };
  const ledger = new QuotaLedgerAdapter(
    new ReserveQuotaUseCase(dependencies),
    new ReopenQuotaReservationUseCase(dependencies),
    new CommitQuotaReservationUseCase(dependencies),
    new RefundQuotaReservationUseCase(dependencies),
    new GetMeteredFeatureQuotaUseCase(dependencies),
  );
  const refundAbandonedReservations = new RefundAbandonedQuotaReservationsUseCase({
    ...dependencies,
    alert,
  });
  return {
    userId,
    users,
    accessStateReader,
    quotaChargeRepository,
    quotaUsageRepository,
    unitOfWork,
    logger,
    alert,
    clock,
    ledger,
    refundAbandonedReservations,
  };
}
