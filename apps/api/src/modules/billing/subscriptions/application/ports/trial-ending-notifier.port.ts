import { BillingNoticeNotifierPort } from "../../../shared/application/ports/billing-notice-notifier.port.js";
import type { TrialEndingNotice } from "./trial-ending-notice.repository.port.js";

export abstract class TrialEndingNotifierPort extends BillingNoticeNotifierPort<TrialEndingNotice> {}
