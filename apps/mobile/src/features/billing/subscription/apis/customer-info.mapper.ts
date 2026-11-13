import type { PurchaseStatus } from '@src/core/ports/purchases-gateway';

import { type CustomerInfo, customerInfoSchema } from '../domains/customer-info.model';

export function toCustomerInfo(dto: PurchaseStatus): CustomerInfo {
  return customerInfoSchema.parse(dto);
}
