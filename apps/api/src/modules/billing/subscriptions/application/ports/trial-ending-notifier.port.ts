import { BillingNoticeNotifierPort } from "../../../shared/application/ports/billing-notice-notifier.port.js";
import type { TrialEndingNotice } from "../../domain/trial-ending-notice.entity.js";

export abstract class TrialEndingNotifierPort extends BillingNoticeNotifierPort<TrialEndingNotice> {}
