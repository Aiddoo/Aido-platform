import {
  PACKAGE_TYPE,
  type PurchasesOfferings,
  type PurchasesPackage,
} from 'react-native-purchases';

import type {
  PlanType,
  SubscriptionOffering,
  SubscriptionPlan,
} from '../models/subscription.model';

export const toPlanType = (packageType: PACKAGE_TYPE): PlanType | null => {
  if (packageType === PACKAGE_TYPE.MONTHLY) {
    return 'monthly';
  }

  if (packageType === PACKAGE_TYPE.ANNUAL) {
    return 'annual';
  }

  return null;
};

export const toSubscriptionPlan = (pkg: PurchasesPackage): SubscriptionPlan | null => {
  const planType = toPlanType(pkg.packageType);

  if (!planType) {
    return null;
  }

  return {
    identifier: pkg.identifier,
    planType,
    priceString: pkg.product.priceString,
    price: pkg.product.price,
    currencyCode: pkg.product.currencyCode,
    title: pkg.product.title,
    description: pkg.product.description ?? null,
  };
};

export const toSubscriptionOffering = (
  offerings: PurchasesOfferings,
): SubscriptionOffering | null => {
  const result = toSubscriptionOfferingWithPackages(offerings);
  return result?.offering ?? null;
};

/** offering + packageMap을 한번의 순회로 동시 생성. null-safe. */
export const toSubscriptionOfferingWithPackages = (
  offerings: PurchasesOfferings,
): { offering: SubscriptionOffering; packageMap: Map<string, PurchasesPackage> } | null => {
  const current = offerings.current;

  if (!current) {
    return null;
  }

  const plans: SubscriptionPlan[] = [];
  const packageMap = new Map<string, PurchasesPackage>();

  for (const pkg of current.availablePackages) {
    const plan = toSubscriptionPlan(pkg);
    if (plan) {
      plans.push(plan);
      packageMap.set(pkg.identifier, pkg);
    }
  }

  return { offering: { identifier: current.identifier, plans }, packageMap };
};
