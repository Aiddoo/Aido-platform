import { BillingNoticeNotifierPort } from "../../../shared/application/ports/billing-notice-notifier.port.js";
import type { PremiumGrantEndingNotice } from "../../domain/premium-grant-ending-notice.entity.js";

export abstract class PremiumGrantNotifierPort extends BillingNoticeNotifierPort<PremiumGrantEndingNotice> {}
