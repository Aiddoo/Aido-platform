import { BillingNoticeRepositoryPort } from "../../../shared/application/ports/billing-notice.repository.port.js";
import type { PremiumGrantEndingNotice } from "../../domain/premium-grant-ending-notice.entity.js";

/** 스토어 구독도 다음 보상 기간도 이어지지 않는 마지막 보상 기간을 고르고 표시한다. */
export abstract class PremiumGrantEndingNoticeRepositoryPort extends BillingNoticeRepositoryPort<PremiumGrantEndingNotice> {}
