import type { Provider } from "@nestjs/common";
import type { ConfigType } from "@nestjs/config";

import { UserBlockReaderPort } from "#api/modules/social/blocks/social-blocks.public";
import {
  FollowReaderPort,
  FriendshipEstablisherPort,
} from "#api/modules/social/friends/social-friends.public";
import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { MutationLockPort } from "#api/shared/application/ports/mutation-lock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { ClaimHasherPort } from "./application/ports/claim-hasher.port.js";
import { InviteCodeGeneratorPort } from "./application/ports/invite-code-generator.port.js";
import { InviteConfigPort } from "./application/ports/invite-config.port.js";
import { InviteNotifierPort } from "./application/ports/invite-notifier.port.js";
import { InviteQualifyReminderSchedulerPort } from "./application/ports/invite-qualify-reminder-scheduler.port.js";
import { InviteRedemptionRepositoryPort } from "./application/ports/invite-redemption.repository.port.js";
import { InviteRewardSchedulerPort } from "./application/ports/invite-reward-scheduler.port.js";
import { InviteUserReaderPort } from "./application/ports/invite-user.reader.port.js";
import { InviteRepositoryPort } from "./application/ports/invite.repository.port.js";
import { RewardApplierPort } from "./application/ports/reward-applier.port.js";
import { RewardClaimRepositoryPort } from "./application/ports/reward-claim.repository.port.js";
import { RewardGrantRepositoryPort } from "./application/ports/reward-grant.repository.port.js";
import { CheckInvitePairReachabilityUseCase } from "./application/use-cases/check-invite-pair-reachability.use-case.js";
import { ExpireStaleRedemptionsUseCase } from "./application/use-cases/expire-stale-redemptions.use-case.js";
import { GetInviteAvailabilityUseCase } from "./application/use-cases/get-invite-availability.use-case.js";
import { GetInvitedFriendsUseCase } from "./application/use-cases/get-invited-friends.use-case.js";
import { GetMyInviteUseCase } from "./application/use-cases/get-my-invite.use-case.js";
import { GrantInviteRewardsUseCase } from "./application/use-cases/grant-invite-rewards.use-case.js";
import { IssueInviteUseCase } from "./application/use-cases/issue-invite.use-case.js";
import { PreviewInviteUseCase } from "./application/use-cases/preview-invite.use-case.js";
import { RecordInviteeActivityUseCase } from "./application/use-cases/record-invitee-activity.use-case.js";
import { RedeemInviteUseCase } from "./application/use-cases/redeem-invite.use-case.js";
import { RotateInviteCodeUseCase } from "./application/use-cases/rotate-invite-code.use-case.js";
import { ScheduleInviteQualifyRemindersUseCase } from "./application/use-cases/schedule-invite-qualify-reminders.use-case.js";
import { SendInviteQualifyReminderUseCase } from "./application/use-cases/send-invite-qualify-reminder.use-case.js";
import { SummarizeMyInviteUseCase } from "./application/use-cases/summarize-my-invite.use-case.js";
import { HmacClaimHasherAdapter } from "./infrastructure/adapters/hmac-claim-hasher.adapter.js";
import { RandomInviteCodeGeneratorAdapter } from "./infrastructure/adapters/invite-code-generator.adapter.js";
import { InviteNotifierAdapter } from "./infrastructure/adapters/invite-notifier.adapter.js";
import { RewardApplierAdapter } from "./infrastructure/adapters/reward-applier.adapter.js";
import { InviteQualifyReminderSchedulerAdapter } from "./infrastructure/jobs/invite-qualify-reminder-scheduler.adapter.js";
import { InviteRewardSchedulerAdapter } from "./infrastructure/jobs/invite-reward-scheduler.adapter.js";
import { DrizzleInviteRedemptionRepository } from "./infrastructure/persistence/drizzle-invite-redemption.repository.js";
import { DrizzleInviteUserReader } from "./infrastructure/persistence/drizzle-invite-user.reader.js";
import { DrizzleInviteRepository } from "./infrastructure/persistence/drizzle-invite.repository.js";
import { DrizzleRewardClaimRepository } from "./infrastructure/persistence/drizzle-reward-claim.repository.js";
import { DrizzleRewardGrantRepository } from "./infrastructure/persistence/drizzle-reward-grant.repository.js";
import { socialInvitesConfig } from "./social-invites.config.js";

export const SOCIAL_INVITES_PROVIDERS = [
  {
    provide: InviteConfigPort,
    inject: [socialInvitesConfig.KEY],
    useFactory: (config: ConfigType<typeof socialInvitesConfig>): InviteConfigPort => ({
      isEnabled: config.enabled,
    }),
  },
  { provide: InviteRepositoryPort, useClass: DrizzleInviteRepository },
  { provide: InviteRedemptionRepositoryPort, useClass: DrizzleInviteRedemptionRepository },
  { provide: RewardGrantRepositoryPort, useClass: DrizzleRewardGrantRepository },
  { provide: RewardClaimRepositoryPort, useClass: DrizzleRewardClaimRepository },
  { provide: InviteUserReaderPort, useClass: DrizzleInviteUserReader },
  { provide: InviteCodeGeneratorPort, useClass: RandomInviteCodeGeneratorAdapter },
  { provide: ClaimHasherPort, useClass: HmacClaimHasherAdapter },
  { provide: InviteNotifierPort, useClass: InviteNotifierAdapter },
  { provide: RewardApplierPort, useClass: RewardApplierAdapter },
  { provide: InviteRewardSchedulerPort, useClass: InviteRewardSchedulerAdapter },
  {
    provide: InviteQualifyReminderSchedulerPort,
    useClass: InviteQualifyReminderSchedulerAdapter,
  },
  provideUseCase(GetInviteAvailabilityUseCase, { inviteConfig: InviteConfigPort }),
  provideUseCase(IssueInviteUseCase, {
    inviteRepository: InviteRepositoryPort,
    codeGenerator: InviteCodeGeneratorPort,
  }),
  provideUseCase(SummarizeMyInviteUseCase, {
    inviteRedemptionRepository: InviteRedemptionRepositoryPort,
    rewardGrantRepository: RewardGrantRepositoryPort,
  }),
  provideUseCase(GetMyInviteUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    inviteRepository: InviteRepositoryPort,
    issueInvite: IssueInviteUseCase,
    summarizeMyInvite: SummarizeMyInviteUseCase,
    inviteConfig: InviteConfigPort,
    clock: ClockPort,
    logger: loggerFor(GetMyInviteUseCase),
  }),
  provideUseCase(RotateInviteCodeUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    inviteRepository: InviteRepositoryPort,
    issueInvite: IssueInviteUseCase,
    summarizeMyInvite: SummarizeMyInviteUseCase,
    inviteConfig: InviteConfigPort,
    clock: ClockPort,
    logger: loggerFor(RotateInviteCodeUseCase),
  }),
  provideUseCase(PreviewInviteUseCase, {
    inviteRepository: InviteRepositoryPort,
    inviteConfig: InviteConfigPort,
  }),
  provideUseCase(GetInvitedFriendsUseCase, {
    inviteRedemptionRepository: InviteRedemptionRepositoryPort,
    inviteConfig: InviteConfigPort,
  }),
  provideUseCase(CheckInvitePairReachabilityUseCase, {
    followReader: FollowReaderPort,
    blockReader: UserBlockReaderPort,
  }),
  provideUseCase(RedeemInviteUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    inviteRepository: InviteRepositoryPort,
    inviteRedemptionRepository: InviteRedemptionRepositoryPort,
    rewardClaimRepository: RewardClaimRepositoryPort,
    rewardGrantRepository: RewardGrantRepositoryPort,
    userReader: InviteUserReaderPort,
    rewardApplier: RewardApplierPort,
    followReader: FollowReaderPort,
    blockReader: UserBlockReaderPort,
    friendshipEstablisher: FriendshipEstablisherPort,
    claimHasher: ClaimHasherPort,
    notifier: InviteNotifierPort,
    rewardScheduler: InviteRewardSchedulerPort,
    inviteConfig: InviteConfigPort,
    clock: ClockPort,
    logger: loggerFor(RedeemInviteUseCase),
  }),
  provideUseCase(RecordInviteeActivityUseCase, {
    unitOfWork: UnitOfWorkPort,
    mutationLock: MutationLockPort,
    inviteRedemptionRepository: InviteRedemptionRepositoryPort,
    rewardGrantRepository: RewardGrantRepositoryPort,
    userReader: InviteUserReaderPort,
    pairReachability: CheckInvitePairReachabilityUseCase,
    rewardScheduler: InviteRewardSchedulerPort,
    notifier: InviteNotifierPort,
    inviteConfig: InviteConfigPort,
    clock: ClockPort,
    logger: loggerFor(RecordInviteeActivityUseCase),
  }),
  provideUseCase(GrantInviteRewardsUseCase, {
    unitOfWork: UnitOfWorkPort,
    rewardGrantRepository: RewardGrantRepositoryPort,
    inviteRedemptionRepository: InviteRedemptionRepositoryPort,
    rewardApplier: RewardApplierPort,
    notifier: InviteNotifierPort,
    alert: OperationalAlertPort,
    inviteConfig: InviteConfigPort,
    clock: ClockPort,
    logger: loggerFor(GrantInviteRewardsUseCase),
  }),
  provideUseCase(ExpireStaleRedemptionsUseCase, {
    unitOfWork: UnitOfWorkPort,
    inviteRedemptionRepository: InviteRedemptionRepositoryPort,
    rewardGrantRepository: RewardGrantRepositoryPort,
    rewardScheduler: InviteRewardSchedulerPort,
    inviteConfig: InviteConfigPort,
    logger: loggerFor(ExpireStaleRedemptionsUseCase),
  }),
  provideUseCase(ScheduleInviteQualifyRemindersUseCase, {
    inviteRedemptionRepository: InviteRedemptionRepositoryPort,
    reminderScheduler: InviteQualifyReminderSchedulerPort,
    inviteConfig: InviteConfigPort,
    logger: loggerFor(ScheduleInviteQualifyRemindersUseCase),
  }),
  provideUseCase(SendInviteQualifyReminderUseCase, {
    unitOfWork: UnitOfWorkPort,
    inviteRedemptionRepository: InviteRedemptionRepositoryPort,
    userReader: InviteUserReaderPort,
    pairReachability: CheckInvitePairReachabilityUseCase,
    notifier: InviteNotifierPort,
    inviteConfig: InviteConfigPort,
    logger: loggerFor(SendInviteQualifyReminderUseCase),
  }),
] satisfies Provider[];
