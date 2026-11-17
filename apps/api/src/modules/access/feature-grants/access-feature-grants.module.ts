import { Module } from "@nestjs/common";

import { AccessQuotaChargesModule } from "#api/modules/access/quota-charges/access-quota-charges.public";
import { PlanningCategoriesModule } from "#api/modules/planning/categories/planning-categories.public";
import { SocialCheersModule } from "#api/modules/social/cheers/social-cheers.public";
import { SocialFriendsModule } from "#api/modules/social/friends/social-friends.public";
import { SocialNudgesModule } from "#api/modules/social/nudges/social-nudges.public";

import { AccessFeatureGrantsQueriesModule } from "./access-feature-grants-queries.module.js";
import { ACCESS_FEATURE_GRANTS_PROVIDERS } from "./access-feature-grants.providers.js";
import { EntitlementController } from "./presentation/http/v1/entitlement.controller.js";

// 권한 현황(GET /v1/entitlements)은 social·planning이 센 사용량을 읽는다. 그 Context들은 queries Module만 import한다
@Module({
  imports: [
    AccessFeatureGrantsQueriesModule,
    AccessQuotaChargesModule,
    SocialCheersModule,
    SocialNudgesModule,
    SocialFriendsModule,
    PlanningCategoriesModule,
  ],
  controllers: [EntitlementController],
  providers: [...ACCESS_FEATURE_GRANTS_PROVIDERS],
})
export class AccessFeatureGrantsModule {}
