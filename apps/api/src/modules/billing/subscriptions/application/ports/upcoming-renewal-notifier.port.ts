import type { BillingNoticeNotifierPort } from "../../../premium-grants/application/ports/billing-notice.port.js";
import type { UpcomingRenewalNotice } from "./upcoming-renewal-notice.repository.port.js";

export const UPCOMING_RENEWAL_NOTIFIER = Symbol("UPCOMING_RENEWAL_NOTIFIER");

export type UpcomingRenewalNotifierPort = BillingNoticeNotifierPort<UpcomingRenewalNotice>;
