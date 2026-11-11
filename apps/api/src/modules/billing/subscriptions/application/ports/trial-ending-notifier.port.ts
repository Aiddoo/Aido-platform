import { BillingNoticeNotifierPort } from "../../../premium-grants/application/ports/billing-notice.port.js";
import type { TrialEndingNotice } from "./trial-ending-notice.repository.port.js";

export abstract class TrialEndingNotifierPort extends BillingNoticeNotifierPort<TrialEndingNotice> {}
