import { Module } from "@nestjs/common";

import { AccessEntitlementsModule } from "#api/modules/access/entitlements/access-entitlements.public";
import { AccessQuotasModule } from "#api/modules/access/quotas/access-quotas.public";
import { PlanningCategoriesModule } from "#api/modules/planning/categories/planning-categories.public";
import { SocialCheersModule } from "#api/modules/social/cheers/social-cheers.public";
import { SocialFriendsModule } from "#api/modules/social/friends/social-friends.public";
import { SocialNudgesModule } from "#api/modules/social/nudges/social-nudges.public";

import { ACCESS_ENTITLEMENT_USAGE_PROVIDERS } from "./access-entitlement-usage.providers.js";
import { EntitlementController } from "./presentation/http/v1/entitlement.controller.js";

// 응원·찌르기 일간 사용량과 친구·카테고리 개수는 social·planning이 센다. 그 Context들이 권한 포트 모듈을
// import하므로 권한 포트(entitlements)와 다른 slice로 두어 순환하지 않는다
@Module({
  imports: [
    AccessEntitlementsModule,
    AccessQuotasModule,
    SocialCheersModule,
    SocialNudgesModule,
    SocialFriendsModule,
    PlanningCategoriesModule,
  ],
  controllers: [EntitlementController],
  providers: [...ACCESS_ENTITLEMENT_USAGE_PROVIDERS],
})
export class AccessEntitlementUsageModule {}
