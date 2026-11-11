import type {
  PurchaseStatus,
  PurchaseOffering,
  PurchasePackage,
  PurchasePackageType,
  PurchasePeriodUnit,
} from '@src/core/ports/purchases-gateway';
import { type PlanType, toPlanType } from '@src/shared/domains/plan-type.model';
import { match } from 'ts-pattern';

import { type CustomerInfo, customerInfoSchema } from '../domains/customer-info.model';
import {
  type FreeTrial,
  type SubscriptionOffering,
  type SubscriptionPlan,
} from '../domains/subscription.model';

function toStorePlanType(packageType: PurchasePackageType): PlanType | null {
  return match(packageType)
    .returnType<PlanType | null>()
    .with('OTHER', () => null)
    .otherwise(toPlanType);
}

function toFreeTrialPeriodUnit(periodUnit: PurchasePeriodUnit): FreeTrial['periodUnit'] {
  return match(periodUnit)
    .returnType<FreeTrial['periodUnit']>()
    .with('DAY', () => 'day')
    .with('WEEK', () => 'week')
    .with('MONTH', () => 'month')
    .with('YEAR', () => 'year')
    .exhaustive();
}

function toFreeTrial(freeTrial: PurchasePackage['product']['freeTrial']): FreeTrial | null {
  if (freeTrial == null) {
    return null;
  }
  return {
    periodUnit: toFreeTrialPeriodUnit(freeTrial.periodUnit),
    periodNumberOfUnits: freeTrial.periodNumberOfUnits,
  };
}

function toSubscriptionPlan(storePackage: PurchasePackage): SubscriptionPlan | null {
  const planType = toStorePlanType(storePackage.packageType);

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
    freeTrial: toFreeTrial(storePackage.product.freeTrial),
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
