import type { BillingNoticeNotifierPort } from "./billing-notice.port.js";
import type { UpcomingRenewalNotice } from "./upcoming-renewal-notice.source.port.js";

export const UPCOMING_RENEWAL_NOTIFIER = Symbol("UPCOMING_RENEWAL_NOTIFIER");

export type UpcomingRenewalNotifierPort = BillingNoticeNotifierPort<UpcomingRenewalNotice>;
