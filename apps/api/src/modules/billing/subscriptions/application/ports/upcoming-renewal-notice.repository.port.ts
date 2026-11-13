import { BillingNoticeRepositoryPort } from "../../../shared/application/ports/billing-notice.repository.port.js";
import type { UpcomingRenewalNotice } from "../../domain/upcoming-renewal-notice.entity.js";

/** 이번 기간에 아직 갱신 안내를 보내지 않은, 연간으로 자동 갱신될 구독을 고르고 표시한다. */
export abstract class UpcomingRenewalNoticeRepositoryPort extends BillingNoticeRepositoryPort<UpcomingRenewalNotice> {}
