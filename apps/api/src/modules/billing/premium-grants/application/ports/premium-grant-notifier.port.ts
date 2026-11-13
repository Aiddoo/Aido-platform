import { BillingNoticeNotifierPort } from "../../../shared/application/ports/billing-notice-notifier.port.js";
import type { PremiumGrantEndingNotice } from "./premium-grant-ending-notice.repository.port.js";

export abstract class PremiumGrantNotifierPort extends BillingNoticeNotifierPort<PremiumGrantEndingNotice> {}
