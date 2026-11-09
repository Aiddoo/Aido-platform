import type { BillingNoticeNotifierPort } from "./billing-notice.port.js";
import type { TrialEndingNotice } from "./trial-ending-notice.source.port.js";

export const TRIAL_ENDING_NOTIFIER = Symbol("TRIAL_ENDING_NOTIFIER");

export type TrialEndingNotifierPort = BillingNoticeNotifierPort<TrialEndingNotice>;
