import type {
  PurchaseStatus,
  PurchaseOffering,
  PurchasePackage,
  PurchasePackageType,
} from '@src/core/ports/purchases';
import { match } from 'ts-pattern';

import { type CustomerInfo, customerInfoSchema } from '../domains/customer-info.model';
import type {
  PlanType,
  SubscriptionOffering,
  SubscriptionPlan,
} from '../domains/subscription.model';

export function toPlanType(packageType: PurchasePackageType): PlanType | null {
  return match(packageType)
    .returnType<PlanType | null>()
    .with('MONTHLY', () => 'monthly')
    .with('ANNUAL', () => 'annual')
    .with('OTHER', () => null)
    .exhaustive();
}

export function toSubscriptionPlan(storePackage: PurchasePackage): SubscriptionPlan | null {
  const planType = toPlanType(storePackage.packageType);

  if (planType == null) {
    return null;
  }

  return {
    identifier: storePackage.identifier,
    planType,
    priceString: storePackage.product.priceString,
    price: storePackage.product.price,
    currencyCode: storePackage.product.currencyCode,
    title: storePackage.product.title,
    description: storePackage.product.description,
  };
}

export function toSubscriptionOffering(offering: PurchaseOffering): SubscriptionOffering {
  return {
    identifier: offering.identifier,
    plans: offering.packages.flatMap((storePackage) => toSubscriptionPlan(storePackage) ?? []),
  };
}

export function toCustomerInfo(dto: PurchaseStatus): CustomerInfo {
  return customerInfoSchema.parse(dto);
}
