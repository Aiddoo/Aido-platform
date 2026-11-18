import { QueryBuilder } from "drizzle-orm/pg-core";

import { userConsent, userPreference } from "#api/platform/database/schema/index";

// 다른 Context가 사람 id 칸 옆에 발송 설정을 한 SQL로 붙이는 하위 질의다. PG가 펼쳐 바로 조인하므로 실행 계획은 테이블 조인과 같다
export function userDeliveryPreference() {
  return new QueryBuilder()
    .select({
      userId: userPreference.userId,
      timezone: userPreference.timezone,
      locale: userPreference.locale,
      pushEnabled: userPreference.pushEnabled,
      nightPushEnabled: userPreference.nightPushEnabled,
    })
    .from(userPreference)
    .as("delivery_preference");
}

export function userMarketingPushConsent() {
  return new QueryBuilder()
    .select({
      userId: userConsent.userId,
      marketingPushAgreedAt: userConsent.marketingPushAgreedAt,
    })
    .from(userConsent)
    .as("marketing_push_consent");
}
