import { Module } from "@nestjs/common";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { AccessQuotaChargesModule } from "#api/modules/access/quota-charges/access-quota-charges.public";
import { BillingPremiumGrantsModule } from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import { EngagementTodoCommentsModule } from "#api/modules/engagement/todo-comments/engagement-todo-comments.public";
import { NotificationNotificationsModule } from "#api/modules/notification/notifications/notification-notifications.public";
import { NotificationPushDevicesQueriesModule } from "#api/modules/notification/push-devices/notification-push-devices.public";
import { NotificationRetentionAssignmentsModule } from "#api/modules/notification/retention-assignments/notification-retention-assignments.public";
import { OperationsAdminNoticesModule } from "#api/modules/operations/admin-notices/operations-admin-notices.public";
import { PlanningTodoCategoriesQueriesModule } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import { SocialCheersModule } from "#api/modules/social/cheers/social-cheers.public";
import { SocialNudgesModule } from "#api/modules/social/nudges/social-nudges.public";

import { IdentityLinkedAccountsModule } from "../linked-accounts/identity-linked-accounts.module.js";
import { IdentityOAuthStatesQueriesModule } from "../oauth-states/identity-oauth-states-queries.module.js";
import { IdentitySessionsQueriesModule } from "../sessions/identity-sessions-queries.module.js";
import { IdentityUserPreferencesModule } from "../user-preferences/identity-user-preferences.module.js";
import { IdentityVerificationsModule } from "../verifications/identity-verifications.module.js";
import { RetentionEnrollerPort } from "./application/ports/retention-enroller.port.js";
import { NotifyOAuthSignupUseCase } from "./application/use-cases/notify-oauth-signup.use-case.js";
import { ProvisionUserUseCase } from "./application/use-cases/provision-user.use-case.js";
import { RestoreAccountUseCase } from "./application/use-cases/restore-account.use-case.js";
import { IdentityUsersQueriesModule } from "./identity-users-queries.module.js";
import { IDENTITY_USERS_PROVIDERS } from "./identity-users.providers.js";
import { AccountPurgeProcessor } from "./infrastructure/jobs/account-purge.processor.js";
import { AccountPurgeScheduler } from "./infrastructure/jobs/account-purge.scheduler.js";
import { ExpiredRecordPurgeProcessor } from "./infrastructure/jobs/expired-record-purge.processor.js";
import { ExpiredRecordPurgeScheduler } from "./infrastructure/jobs/expired-record-purge.scheduler.js";
import { LastActiveInterceptor } from "./presentation/http/interceptors/last-active.interceptor.js";
import { RegistrationController } from "./presentation/http/v1/registration.controller.js";
import { UserAccountController } from "./presentation/http/v1/user-account.controller.js";

// 로그인(sessions)과 웹 OAuth(oauth-states)가 가입·복구·가입 알림 UseCase를 쓴다. 세션 폐기는 그 아래층
// 세션 조회 Module의 포트로 해서 users → sessions 기능 Module 방향의 import가 없다
@Module({
  imports: [
    IdentityUsersQueriesModule,
    IdentitySessionsQueriesModule,
    IdentityOAuthStatesQueriesModule,
    IdentityLinkedAccountsModule,
    IdentityVerificationsModule,
    IdentityUserPreferencesModule,
    PlanningTodoCategoriesQueriesModule,
    NotificationRetentionAssignmentsModule,
    OperationsAdminNoticesModule,
    AccessFeatureGrantsQueriesModule,
    AccessQuotaChargesModule,
    BillingPremiumGrantsModule,
    EngagementTodoCommentsModule,
    NotificationNotificationsModule,
    NotificationPushDevicesQueriesModule,
    SocialCheersModule,
    SocialNudgesModule,
  ],
  controllers: [RegistrationController, UserAccountController],
  providers: [
    ...IDENTITY_USERS_PROVIDERS,
    AccountPurgeScheduler,
    AccountPurgeProcessor,
    ExpiredRecordPurgeScheduler,
    ExpiredRecordPurgeProcessor,
    LastActiveInterceptor,
  ],
  exports: [
    ProvisionUserUseCase,
    RestoreAccountUseCase,
    NotifyOAuthSignupUseCase,
    RetentionEnrollerPort,
    LastActiveInterceptor,
  ],
})
export class IdentityUsersModule {}
