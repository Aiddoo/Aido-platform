import { BillingNoticeNotifierPort } from "./billing-notice.port.js";
import type { PremiumGrantEndingNotice } from "./premium-grant-ending-notice.repository.port.js";

export abstract class PremiumGrantNotifierPort extends BillingNoticeNotifierPort<PremiumGrantEndingNotice> {}
