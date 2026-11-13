import { BillingNoticeNotifierPort } from "../../../shared/application/ports/billing-notice-notifier.port.js";
import type { UpcomingRenewalNotice } from "../../domain/upcoming-renewal-notice.entity.js";

export abstract class UpcomingRenewalNotifierPort extends BillingNoticeNotifierPort<UpcomingRenewalNotice> {}
