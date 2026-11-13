import { Inject, Injectable } from "@nestjs/common";

import { StoreCustomerConsolePort } from "../../../application/ports/store-customer-console.port.js";
import {
  type BillingSubscriptionsConfig,
  billingSubscriptionsConfig,
} from "../../../billing-subscriptions.config.js";

/** RevenueCat 대시보드의 고객 화면. 프로젝트 ID가 있어야 주소를 만들 수 있다. */
@Injectable()
export class RevenueCatCustomerConsoleAdapter extends StoreCustomerConsolePort {
  readonly #projectId: string | undefined;

  constructor(
    @Inject(billingSubscriptionsConfig.KEY) config: Pick<BillingSubscriptionsConfig, "revenuecat">,
  ) {
    super();
    this.#projectId = config.revenuecat.projectId;
  }

  customerUrlOf(appUserId: string): string | null {
    if (this.#projectId == null) {
      return null;
    }
    return `https://app.revenuecat.com/projects/${encodeURIComponent(this.#projectId)}/customers/${encodeURIComponent(appUserId)}`;
  }
}
