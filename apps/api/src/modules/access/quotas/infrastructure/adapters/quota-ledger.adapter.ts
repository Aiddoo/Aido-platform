import type { MeteredFeatureKey } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  QuotaLedgerPort,
  type QuotaReserveInput,
} from "../../application/ports/quota-ledger.port.js";
import {
  toMeteredFeatureQuota,
  type MeteredFeatureQuota,
} from "../../application/read-models/metered-feature-quota.read-model.js";
import type { QuotaReservation } from "../../application/read-models/quota-reservation.read-model.js";
import { CommitQuotaReservationUseCase } from "../../application/use-cases/commit-quota-reservation.use-case.js";
import { GetMeteredFeatureQuotaUseCase } from "../../application/use-cases/get-metered-feature-quota.use-case.js";
import { RefundQuotaReservationUseCase } from "../../application/use-cases/refund-quota-reservation.use-case.js";
import { ReopenQuotaReservationUseCase } from "../../application/use-cases/reopen-quota-reservation.use-case.js";
import { ReserveQuotaUseCase } from "../../application/use-cases/reserve-quota.use-case.js";
import type { QuotaRefundReason } from "../../domain/quotas.constants.js";

// 다른 Context에 여는 문. 명령은 UseCase에 그대로 넘기고 읽은 시각은 계약 문자열로 바꾼다
@Injectable()
export class QuotaLedgerAdapter implements QuotaLedgerPort {
  readonly #reserveQuota: Pick<ReserveQuotaUseCase, "execute">;
  readonly #reopenQuotaReservation: Pick<ReopenQuotaReservationUseCase, "execute">;
  readonly #commitQuotaReservation: Pick<CommitQuotaReservationUseCase, "execute">;
  readonly #refundQuotaReservation: Pick<RefundQuotaReservationUseCase, "execute">;
  readonly #getMeteredFeatureQuota: Pick<GetMeteredFeatureQuotaUseCase, "execute">;

  constructor(
    reserveQuota: ReserveQuotaUseCase,
    reopenQuotaReservation: ReopenQuotaReservationUseCase,
    commitQuotaReservation: CommitQuotaReservationUseCase,
    refundQuotaReservation: RefundQuotaReservationUseCase,
    getMeteredFeatureQuota: GetMeteredFeatureQuotaUseCase,
  ) {
    this.#reserveQuota = reserveQuota;
    this.#reopenQuotaReservation = reopenQuotaReservation;
    this.#commitQuotaReservation = commitQuotaReservation;
    this.#refundQuotaReservation = refundQuotaReservation;
    this.#getMeteredFeatureQuota = getMeteredFeatureQuota;
  }

  reserve(input: QuotaReserveInput): Promise<QuotaReservation> {
    return this.#reserveQuota.execute(input);
  }

  reopen(reservation: QuotaReservation): Promise<QuotaReservation> {
    return this.#reopenQuotaReservation.execute(reservation);
  }

  commit(reservation: QuotaReservation): Promise<boolean> {
    return this.#commitQuotaReservation.execute(reservation);
  }

  refund(reservation: QuotaReservation, reason: QuotaRefundReason): Promise<boolean> {
    return this.#refundQuotaReservation.execute({ reservation, reason });
  }

  async read(userId: UserId, feature: MeteredFeatureKey): Promise<MeteredFeatureQuota> {
    return toMeteredFeatureQuota(
      await this.#getMeteredFeatureQuota.execute({ userId: userId.value, feature }),
    );
  }
}
