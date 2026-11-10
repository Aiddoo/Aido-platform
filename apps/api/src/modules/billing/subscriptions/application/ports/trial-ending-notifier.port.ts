import type { BillingNoticeNotifierPort } from "../../../premium-grants/application/ports/billing-notice.port.js";
import type { TrialEndingNotice } from "./trial-ending-notice.repository.port.js";

export const TRIAL_ENDING_NOTIFIER = Symbol("TRIAL_ENDING_NOTIFIER");

export type TrialEndingNotifierPort = BillingNoticeNotifierPort<TrialEndingNotice>;
