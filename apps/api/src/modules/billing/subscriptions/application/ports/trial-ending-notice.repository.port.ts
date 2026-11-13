import { BillingNoticeRepositoryPort } from "../../../shared/application/ports/billing-notice.repository.port.js";
import type { TrialEndingNotice } from "../../domain/trial-ending-notice.entity.js";

/** 아직 종료 안내를 보내지 않은 무료 체험 구독을 고르고 표시한다. */
export abstract class TrialEndingNoticeRepositoryPort extends BillingNoticeRepositoryPort<TrialEndingNotice> {}
