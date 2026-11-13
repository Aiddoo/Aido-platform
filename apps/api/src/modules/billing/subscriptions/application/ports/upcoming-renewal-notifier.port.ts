import { BillingNoticeNotifierPort } from "../../../shared/application/ports/billing-notice-notifier.port.js";
import type { UpcomingRenewalNotice } from "./upcoming-renewal-notice.repository.port.js";

export abstract class UpcomingRenewalNotifierPort extends BillingNoticeNotifierPort<UpcomingRenewalNotice> {}
