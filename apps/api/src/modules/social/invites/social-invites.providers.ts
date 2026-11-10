import { Logger, type FactoryProvider } from "@nestjs/common";

import { PREMIUM_GRANTER } from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import { USER_BLOCK_READER } from "#api/modules/social/blocks/social-blocks.public";
import {
  FOLLOW_READER,
  FRIENDSHIP_ESTABLISHER,
} from "#api/modules/social/friends/social-friends.public";
import {
  MUTATION_LOCK,
  OPERATIONAL_ALERT,
  UNIT_OF_WORK,
} from "#api/shared/application/ports/index";

import { MyInviteReader } from "./application/my-invite.reader.js";
import { CLAIM_HASHER } from "./application/ports/claim-hasher.port.js";
import { INVITE_CONFIG } from "./application/ports/invite-config.port.js";
import { INVITE_NOTIFIER } from "./application/ports/invite-notifier.port.js";
import { INVITE_QUALIFY_REMINDER_SCHEDULER } from "./application/ports/invite-qualify-reminder-scheduler.port.js";
import { INVITE_REDEMPTION_REPOSITORY } from "./application/ports/invite-redemption.repository.port.js";
import { INVITE_REWARD_SCHEDULER } from "./application/ports/invite-reward-scheduler.port.js";
import { INVITE_REPOSITORY } from "./application/ports/invite.repository.port.js";
import { REWARD_APPLIERS } from "./application/ports/reward-applier.port.js";
import { REWARD_CLAIM_REPOSITORY } from "./application/ports/reward-claim.repository.port.js";
import { REWARD_GRANT_REPOSITORY } from "./application/ports/reward-grant.repository.port.js";
import { ExpireStaleRedemptionsUseCase } from "./application/use-cases/expire-stale-redemptions.use-case.js";
import { GetInviteAvailabilityUseCase } from "./application/use-cases/get-invite-availability.use-case.js";
import { GetInvitedFriendsUseCase } from "./application/use-cases/get-invited-friends.use-case.js";
import { GetMyInviteUseCase } from "./application/use-cases/get-my-invite.use-case.js";
import { GrantInviteRewardsUseCase } from "./application/use-cases/grant-invite-rewards.use-case.js";
import { PreviewInviteUseCase } from "./application/use-cases/preview-invite.use-case.js";
import { RecordInviteeActivityUseCase } from "./application/use-cases/record-invitee-activity.use-case.js";
import { RedeemInviteUseCase } from "./application/use-cases/redeem-invite.use-case.js";
import { RotateInviteCodeUseCase } from "./application/use-cases/rotate-invite-code.use-case.js";
import { ScheduleInviteQualifyRemindersUseCase } from "./application/use-cases/schedule-invite-qualify-reminders.use-case.js";
import { SendInviteQualifyReminderUseCase } from "./application/use-cases/send-invite-qualify-reminder.use-case.js";

export const myInviteReaderProvider: FactoryProvider<MyInviteReader> = {
  provide: MyInviteReader,
  inject: [INVITE_REDEMPTION_REPOSITORY, REWARD_GRANT_REPOSITORY],
  useFactory: (
    inviteRedemptionRepository: ConstructorParameters<
      typeof MyInviteReader
    >[0]["inviteRedemptionRepository"],
    rewardGrantRepository: ConstructorParameters<typeof MyInviteReader>[0]["rewardGrantRepository"],
  ) => new MyInviteReader({ inviteRedemptionRepository, rewardGrantRepository }),
};

export const getInviteAvailabilityProvider: FactoryProvider<GetInviteAvailabilityUseCase> = {
  provide: GetInviteAvailabilityUseCase,
  inject: [INVITE_CONFIG],
  useFactory: (
    inviteConfig: ConstructorParameters<typeof GetInviteAvailabilityUseCase>[0]["inviteConfig"],
  ) => new GetInviteAvailabilityUseCase({ inviteConfig }),
};

export const getMyInviteProvider: FactoryProvider<GetMyInviteUseCase> = {
  provide: GetMyInviteUseCase,
  inject: [INVITE_REPOSITORY, MyInviteReader, INVITE_CONFIG, MUTATION_LOCK, UNIT_OF_WORK],
  useFactory: (
    inviteRepository: ConstructorParameters<typeof GetMyInviteUseCase>[0]["inviteRepository"],
    myInviteReader: ConstructorParameters<typeof GetMyInviteUseCase>[0]["myInviteReader"],
    inviteConfig: ConstructorParameters<typeof GetMyInviteUseCase>[0]["inviteConfig"],
    mutationLock: ConstructorParameters<typeof GetMyInviteUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof GetMyInviteUseCase>[0]["unitOfWork"],
  ) =>
    new GetMyInviteUseCase({
      inviteRepository,
      myInviteReader,
      inviteConfig,
      mutationLock,
      unitOfWork,
      logger: new Logger(GetMyInviteUseCase.name),
    }),
};

export const rotateInviteCodeProvider: FactoryProvider<RotateInviteCodeUseCase> = {
  provide: RotateInviteCodeUseCase,
  inject: [INVITE_REPOSITORY, MyInviteReader, INVITE_CONFIG, MUTATION_LOCK, UNIT_OF_WORK],
  useFactory: (
    inviteRepository: ConstructorParameters<typeof RotateInviteCodeUseCase>[0]["inviteRepository"],
    myInviteReader: ConstructorParameters<typeof RotateInviteCodeUseCase>[0]["myInviteReader"],
    inviteConfig: ConstructorParameters<typeof RotateInviteCodeUseCase>[0]["inviteConfig"],
    mutationLock: ConstructorParameters<typeof RotateInviteCodeUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof RotateInviteCodeUseCase>[0]["unitOfWork"],
  ) =>
    new RotateInviteCodeUseCase({
      inviteRepository,
      myInviteReader,
      inviteConfig,
      mutationLock,
      unitOfWork,
      logger: new Logger(RotateInviteCodeUseCase.name),
    }),
};

export const previewInviteProvider: FactoryProvider<PreviewInviteUseCase> = {
  provide: PreviewInviteUseCase,
  inject: [INVITE_REPOSITORY, INVITE_CONFIG],
  useFactory: (
    inviteRepository: ConstructorParameters<typeof PreviewInviteUseCase>[0]["inviteRepository"],
    inviteConfig: ConstructorParameters<typeof PreviewInviteUseCase>[0]["inviteConfig"],
  ) => new PreviewInviteUseCase({ inviteRepository, inviteConfig }),
};

export const getInvitedFriendsProvider: FactoryProvider<GetInvitedFriendsUseCase> = {
  provide: GetInvitedFriendsUseCase,
  inject: [INVITE_REDEMPTION_REPOSITORY, INVITE_CONFIG],
  useFactory: (
    inviteRedemptionRepository: ConstructorParameters<
      typeof GetInvitedFriendsUseCase
    >[0]["inviteRedemptionRepository"],
    inviteConfig: ConstructorParameters<typeof GetInvitedFriendsUseCase>[0]["inviteConfig"],
  ) => new GetInvitedFriendsUseCase({ inviteRedemptionRepository, inviteConfig }),
};

export const redeemInviteProvider: FactoryProvider<RedeemInviteUseCase> = {
  provide: RedeemInviteUseCase,
  inject: [
    INVITE_REPOSITORY,
    INVITE_REDEMPTION_REPOSITORY,
    REWARD_CLAIM_REPOSITORY,
    REWARD_GRANT_REPOSITORY,
    FOLLOW_READER,
    USER_BLOCK_READER,
    FRIENDSHIP_ESTABLISHER,
    CLAIM_HASHER,
    INVITE_NOTIFIER,
    INVITE_REWARD_SCHEDULER,
    INVITE_CONFIG,
    MUTATION_LOCK,
    UNIT_OF_WORK,
    PREMIUM_GRANTER,
  ],
  useFactory: (
    inviteRepository: ConstructorParameters<typeof RedeemInviteUseCase>[0]["inviteRepository"],
    inviteRedemptionRepository: ConstructorParameters<
      typeof RedeemInviteUseCase
    >[0]["inviteRedemptionRepository"],
    rewardClaimRepository: ConstructorParameters<
      typeof RedeemInviteUseCase
    >[0]["rewardClaimRepository"],
    rewardGrantRepository: ConstructorParameters<
      typeof RedeemInviteUseCase
    >[0]["rewardGrantRepository"],
    followReader: ConstructorParameters<typeof RedeemInviteUseCase>[0]["followReader"],
    blockReader: ConstructorParameters<typeof RedeemInviteUseCase>[0]["blockReader"],
    friendshipEstablisher: ConstructorParameters<
      typeof RedeemInviteUseCase
    >[0]["friendshipEstablisher"],
    claimHasher: ConstructorParameters<typeof RedeemInviteUseCase>[0]["claimHasher"],
    notifier: ConstructorParameters<typeof RedeemInviteUseCase>[0]["notifier"],
    rewardScheduler: ConstructorParameters<typeof RedeemInviteUseCase>[0]["rewardScheduler"],
    inviteConfig: ConstructorParameters<typeof RedeemInviteUseCase>[0]["inviteConfig"],
    mutationLock: ConstructorParameters<typeof RedeemInviteUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof RedeemInviteUseCase>[0]["unitOfWork"],
    premiumGranter: ConstructorParameters<typeof RedeemInviteUseCase>[0]["premiumGranter"],
  ) =>
    new RedeemInviteUseCase({
      inviteRepository,
      inviteRedemptionRepository,
      rewardClaimRepository,
      rewardGrantRepository,
      followReader,
      blockReader,
      friendshipEstablisher,
      claimHasher,
      notifier,
      rewardScheduler,
      inviteConfig,
      mutationLock,
      unitOfWork,
      premiumGranter,
      logger: new Logger(RedeemInviteUseCase.name),
    }),
};

export const recordInviteeActivityProvider: FactoryProvider<RecordInviteeActivityUseCase> = {
  provide: RecordInviteeActivityUseCase,
  inject: [
    INVITE_REDEMPTION_REPOSITORY,
    REWARD_GRANT_REPOSITORY,
    INVITE_REWARD_SCHEDULER,
    INVITE_NOTIFIER,
    FOLLOW_READER,
    USER_BLOCK_READER,
    INVITE_CONFIG,
    MUTATION_LOCK,
    UNIT_OF_WORK,
  ],
  useFactory: (
    inviteRedemptionRepository: ConstructorParameters<
      typeof RecordInviteeActivityUseCase
    >[0]["inviteRedemptionRepository"],
    rewardGrantRepository: ConstructorParameters<
      typeof RecordInviteeActivityUseCase
    >[0]["rewardGrantRepository"],
    rewardScheduler: ConstructorParameters<
      typeof RecordInviteeActivityUseCase
    >[0]["rewardScheduler"],
    notifier: ConstructorParameters<typeof RecordInviteeActivityUseCase>[0]["notifier"],
    followReader: ConstructorParameters<typeof RecordInviteeActivityUseCase>[0]["followReader"],
    blockReader: ConstructorParameters<typeof RecordInviteeActivityUseCase>[0]["blockReader"],
    inviteConfig: ConstructorParameters<typeof RecordInviteeActivityUseCase>[0]["inviteConfig"],
    mutationLock: ConstructorParameters<typeof RecordInviteeActivityUseCase>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof RecordInviteeActivityUseCase>[0]["unitOfWork"],
  ) =>
    new RecordInviteeActivityUseCase({
      inviteRedemptionRepository,
      rewardGrantRepository,
      rewardScheduler,
      notifier,
      followReader,
      blockReader,
      inviteConfig,
      mutationLock,
      unitOfWork,
      logger: new Logger(RecordInviteeActivityUseCase.name),
    }),
};

export const grantInviteRewardsProvider: FactoryProvider<GrantInviteRewardsUseCase> = {
  provide: GrantInviteRewardsUseCase,
  inject: [
    REWARD_GRANT_REPOSITORY,
    INVITE_REDEMPTION_REPOSITORY,
    REWARD_APPLIERS,
    INVITE_NOTIFIER,
    OPERATIONAL_ALERT,
    INVITE_CONFIG,
    UNIT_OF_WORK,
  ],
  useFactory: (
    rewardGrantRepository: ConstructorParameters<
      typeof GrantInviteRewardsUseCase
    >[0]["rewardGrantRepository"],
    inviteRedemptionRepository: ConstructorParameters<
      typeof GrantInviteRewardsUseCase
    >[0]["inviteRedemptionRepository"],
    rewardAppliers: ConstructorParameters<typeof GrantInviteRewardsUseCase>[0]["rewardAppliers"],
    notifier: ConstructorParameters<typeof GrantInviteRewardsUseCase>[0]["notifier"],
    alert: ConstructorParameters<typeof GrantInviteRewardsUseCase>[0]["alert"],
    inviteConfig: ConstructorParameters<typeof GrantInviteRewardsUseCase>[0]["inviteConfig"],
    unitOfWork: ConstructorParameters<typeof GrantInviteRewardsUseCase>[0]["unitOfWork"],
  ) =>
    new GrantInviteRewardsUseCase({
      rewardGrantRepository,
      inviteRedemptionRepository,
      rewardAppliers,
      notifier,
      alert,
      inviteConfig,
      unitOfWork,
      logger: new Logger(GrantInviteRewardsUseCase.name),
    }),
};

export const expireStaleRedemptionsProvider: FactoryProvider<ExpireStaleRedemptionsUseCase> = {
  provide: ExpireStaleRedemptionsUseCase,
  inject: [
    INVITE_REDEMPTION_REPOSITORY,
    REWARD_GRANT_REPOSITORY,
    INVITE_REWARD_SCHEDULER,
    INVITE_CONFIG,
    UNIT_OF_WORK,
  ],
  useFactory: (
    inviteRedemptionRepository: ConstructorParameters<
      typeof ExpireStaleRedemptionsUseCase
    >[0]["inviteRedemptionRepository"],
    rewardGrantRepository: ConstructorParameters<
      typeof ExpireStaleRedemptionsUseCase
    >[0]["rewardGrantRepository"],
    rewardScheduler: ConstructorParameters<
      typeof ExpireStaleRedemptionsUseCase
    >[0]["rewardScheduler"],
    inviteConfig: ConstructorParameters<typeof ExpireStaleRedemptionsUseCase>[0]["inviteConfig"],
    unitOfWork: ConstructorParameters<typeof ExpireStaleRedemptionsUseCase>[0]["unitOfWork"],
  ) =>
    new ExpireStaleRedemptionsUseCase({
      inviteRedemptionRepository,
      rewardGrantRepository,
      rewardScheduler,
      inviteConfig,
      unitOfWork,
      logger: new Logger(ExpireStaleRedemptionsUseCase.name),
    }),
};

export const scheduleInviteQualifyRemindersProvider: FactoryProvider<ScheduleInviteQualifyRemindersUseCase> =
  {
    provide: ScheduleInviteQualifyRemindersUseCase,
    inject: [INVITE_REDEMPTION_REPOSITORY, INVITE_QUALIFY_REMINDER_SCHEDULER, INVITE_CONFIG],
    useFactory: (
      inviteRedemptionRepository: ConstructorParameters<
        typeof ScheduleInviteQualifyRemindersUseCase
      >[0]["inviteRedemptionRepository"],
      reminderScheduler: ConstructorParameters<
        typeof ScheduleInviteQualifyRemindersUseCase
      >[0]["reminderScheduler"],
      inviteConfig: ConstructorParameters<
        typeof ScheduleInviteQualifyRemindersUseCase
      >[0]["inviteConfig"],
    ) =>
      new ScheduleInviteQualifyRemindersUseCase({
        inviteRedemptionRepository,
        reminderScheduler,
        inviteConfig,
        logger: new Logger(ScheduleInviteQualifyRemindersUseCase.name),
      }),
  };

export const sendInviteQualifyReminderProvider: FactoryProvider<SendInviteQualifyReminderUseCase> =
  {
    provide: SendInviteQualifyReminderUseCase,
    inject: [
      INVITE_REDEMPTION_REPOSITORY,
      INVITE_NOTIFIER,
      FOLLOW_READER,
      USER_BLOCK_READER,
      INVITE_CONFIG,
      UNIT_OF_WORK,
    ],
    useFactory: (
      inviteRedemptionRepository: ConstructorParameters<
        typeof SendInviteQualifyReminderUseCase
      >[0]["inviteRedemptionRepository"],
      notifier: ConstructorParameters<typeof SendInviteQualifyReminderUseCase>[0]["notifier"],
      followReader: ConstructorParameters<
        typeof SendInviteQualifyReminderUseCase
      >[0]["followReader"],
      blockReader: ConstructorParameters<typeof SendInviteQualifyReminderUseCase>[0]["blockReader"],
      inviteConfig: ConstructorParameters<
        typeof SendInviteQualifyReminderUseCase
      >[0]["inviteConfig"],
      unitOfWork: ConstructorParameters<typeof SendInviteQualifyReminderUseCase>[0]["unitOfWork"],
    ) =>
      new SendInviteQualifyReminderUseCase({
        inviteRedemptionRepository,
        notifier,
        followReader,
        blockReader,
        inviteConfig,
        unitOfWork,
        logger: new Logger(SendInviteQualifyReminderUseCase.name),
      }),
  };
