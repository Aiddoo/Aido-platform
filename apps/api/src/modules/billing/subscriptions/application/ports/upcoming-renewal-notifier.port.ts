import { BillingNoticeNotifierPort } from "../../../premium-grants/application/ports/billing-notice.port.js";
import type { UpcomingRenewalNotice } from "./upcoming-renewal-notice.repository.port.js";

export abstract class UpcomingRenewalNotifierPort extends BillingNoticeNotifierPort<UpcomingRenewalNotice> {}
