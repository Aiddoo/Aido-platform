import type { BillingNoticeNotifierPort } from "./billing-notice.port.js";
import type { PremiumGrantEndingNotice } from "./premium-grant-ending-notice.repository.port.js";

export const PREMIUM_GRANT_NOTIFIER = Symbol("PREMIUM_GRANT_NOTIFIER");

export type PremiumGrantNotifierPort = BillingNoticeNotifierPort<PremiumGrantEndingNotice>;
