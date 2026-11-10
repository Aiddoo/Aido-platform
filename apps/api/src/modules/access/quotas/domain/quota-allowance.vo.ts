import {
  PLAN_CATALOG,
  type AccessTier,
  type MeteredFeatureKey,
  type QuotaMeter,
} from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import {
  resolveAccessTier,
  resolveFeatureQuota,
  resolveQuotaLimit,
  type AccessState,
  type FeatureQuotaState,
} from "../../entitlements/domain/entitlement.domain-service.js";
import { NO_RESOURCE_BONUSES } from "../../entitlements/domain/entitlements.constants.js";
import { QuotaWindow } from "./quota-window.vo.js";

interface QuotaAllowanceValue {
  readonly feature: MeteredFeatureKey;
  readonly tier: AccessTier;
  readonly window: QuotaWindow;
}

/** 계량기 기능의 featureQuota. 사용량을 항상 세므로 used·resetsAt이 있다. */
export interface MeteredQuotaState extends FeatureQuotaState {
  readonly used: number;
  readonly resetsAt: Temporal.Instant;
}

/** 한 계량기 기능을 판단 시각의 최신 권한으로 얼마나 쓸 수 있는지. 원장 판단 한 번에 하나를 만든다. */
export class QuotaAllowance extends ValueObject<QuotaAllowanceValue> {
  static create(params: {
    readonly feature: MeteredFeatureKey;
    readonly state: AccessState;
    readonly now: Temporal.Instant;
  }): QuotaAllowance {
    return new QuotaAllowance({
      feature: params.feature,
      tier: resolveAccessTier(params).tier,
      window: QuotaWindow.monthOf(params.now),
    });
  }

  get feature(): MeteredFeatureKey {
    return this.value.feature;
  }

  get tier(): AccessTier {
    return this.value.tier;
  }

  get window(): QuotaWindow {
    return this.value.window;
  }

  get meter(): QuotaMeter {
    return PLAN_CATALOG[this.value.feature].meter;
  }

  /** 집행 한도(공정 사용 상한 포함). null은 무제한이다. */
  get limit(): number | null {
    return resolveQuotaLimit(this.value).limit;
  }

  toFeatureQuota(used: number): MeteredQuotaState {
    const resetsAt = this.value.window.resetsAt;
    const state = resolveFeatureQuota({
      tier: this.value.tier,
      feature: this.value.feature,
      resourceBonuses: NO_RESOURCE_BONUSES,
      usage: { used, resetsAt },
    });
    return { ...state, used, resetsAt };
  }
}
