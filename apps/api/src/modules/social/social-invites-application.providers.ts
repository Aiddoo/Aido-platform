import { Logger, type FactoryProvider } from "@nestjs/common";

import { PREMIUM_GRANTER } from "#api/modules/billing/billing-subscriptions.public";
import { USER_BLOCK_READER } from "#api/modules/social/social-blocks.public";
import { FOLLOW_READER, FRIENDSHIP_ESTABLISHER } from "#api/modules/social/social-friends.public";
import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { CLAIM_HASHER } from "./application/ports/invites/claim-hasher.port.js";
import { INVITE_NOTIFIER } from "./application/ports/invites/invite-notifier.port.js";
import { INVITE_REDEMPTION_REPOSITORY } from "./application/ports/invites/invite-redemption.repository.port.js";
import { INVITE_REWARD_ALERT } from "./application/ports/invites/invite-reward-alert.port.js";
import { INVITE_REWARD_SCHEDULER } from "./application/ports/invites/invite-reward.scheduler.port.js";
import { INVITE_CONFIG } from "./application/ports/invites/invite.config.port.js";
import { INVITE_REPOSITORY } from "./application/ports/invites/invite.repository.port.js";
import { REWARD_APPLIERS } from "./application/ports/invites/reward-applier.port.js";
import { REWARD_CLAIM_REPOSITORY } from "./application/ports/invites/reward-claim.repository.port.js";
import { REWARD_GRANT_REPOSITORY } from "./application/ports/invites/reward-grant.repository.port.js";
import { MyInviteReader } from "./application/services/invites/my-invite.reader.js";
import { ExpireStaleRedemptions } from "./application/use-cases/invites/expire-stale-redemptions.use-case.js";
import { GetInviteAvailability } from "./application/use-cases/invites/get-invite-availability.use-case.js";
import { GetInvitedFriends } from "./application/use-cases/invites/get-invited-friends.use-case.js";
import { GetMyInvite } from "./application/use-cases/invites/get-my-invite.use-case.js";
import { GrantInviteRewards } from "./application/use-cases/invites/grant-invite-rewards.use-case.js";
import { PreviewInvite } from "./application/use-cases/invites/preview-invite.use-case.js";
import { RecordInviteeActivity } from "./application/use-cases/invites/record-invitee-activity.use-case.js";
import { RedeemInvite } from "./application/use-cases/invites/redeem-invite.use-case.js";
import { RotateInviteCode } from "./application/use-cases/invites/rotate-invite-code.use-case.js";

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

export const getInviteAvailabilityProvider: FactoryProvider<GetInviteAvailability> = {
  provide: GetInviteAvailability,
  inject: [INVITE_CONFIG],
  useFactory: (
    inviteConfig: ConstructorParameters<typeof GetInviteAvailability>[0]["inviteConfig"],
  ) => new GetInviteAvailability({ inviteConfig }),
};

export const getMyInviteProvider: FactoryProvider<GetMyInvite> = {
  provide: GetMyInvite,
  inject: [INVITE_REPOSITORY, MyInviteReader, INVITE_CONFIG, MUTATION_LOCK, UNIT_OF_WORK],
  useFactory: (
    inviteRepository: ConstructorParameters<typeof GetMyInvite>[0]["inviteRepository"],
    myInviteReader: ConstructorParameters<typeof GetMyInvite>[0]["myInviteReader"],
    inviteConfig: ConstructorParameters<typeof GetMyInvite>[0]["inviteConfig"],
    mutationLock: ConstructorParameters<typeof GetMyInvite>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof GetMyInvite>[0]["unitOfWork"],
  ) =>
    new GetMyInvite({
      inviteRepository,
      myInviteReader,
      inviteConfig,
      mutationLock,
      unitOfWork,
      logger: new Logger(GetMyInvite.name),
    }),
};

export const rotateInviteCodeProvider: FactoryProvider<RotateInviteCode> = {
  provide: RotateInviteCode,
  inject: [INVITE_REPOSITORY, MyInviteReader, INVITE_CONFIG, MUTATION_LOCK, UNIT_OF_WORK],
  useFactory: (
    inviteRepository: ConstructorParameters<typeof RotateInviteCode>[0]["inviteRepository"],
    myInviteReader: ConstructorParameters<typeof RotateInviteCode>[0]["myInviteReader"],
    inviteConfig: ConstructorParameters<typeof RotateInviteCode>[0]["inviteConfig"],
    mutationLock: ConstructorParameters<typeof RotateInviteCode>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof RotateInviteCode>[0]["unitOfWork"],
  ) =>
    new RotateInviteCode({
      inviteRepository,
      myInviteReader,
      inviteConfig,
      mutationLock,
      unitOfWork,
      logger: new Logger(RotateInviteCode.name),
    }),
};

export const previewInviteProvider: FactoryProvider<PreviewInvite> = {
  provide: PreviewInvite,
  inject: [INVITE_REPOSITORY, INVITE_CONFIG],
  useFactory: (
    inviteRepository: ConstructorParameters<typeof PreviewInvite>[0]["inviteRepository"],
    inviteConfig: ConstructorParameters<typeof PreviewInvite>[0]["inviteConfig"],
  ) => new PreviewInvite({ inviteRepository, inviteConfig }),
};

export const getInvitedFriendsProvider: FactoryProvider<GetInvitedFriends> = {
  provide: GetInvitedFriends,
  inject: [INVITE_REDEMPTION_REPOSITORY, INVITE_CONFIG],
  useFactory: (
    inviteRedemptionRepository: ConstructorParameters<
      typeof GetInvitedFriends
    >[0]["inviteRedemptionRepository"],
    inviteConfig: ConstructorParameters<typeof GetInvitedFriends>[0]["inviteConfig"],
  ) => new GetInvitedFriends({ inviteRedemptionRepository, inviteConfig }),
};

export const redeemInviteProvider: FactoryProvider<RedeemInvite> = {
  provide: RedeemInvite,
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
    inviteRepository: ConstructorParameters<typeof RedeemInvite>[0]["inviteRepository"],
    inviteRedemptionRepository: ConstructorParameters<
      typeof RedeemInvite
    >[0]["inviteRedemptionRepository"],
    rewardClaimRepository: ConstructorParameters<typeof RedeemInvite>[0]["rewardClaimRepository"],
    rewardGrantRepository: ConstructorParameters<typeof RedeemInvite>[0]["rewardGrantRepository"],
    followReader: ConstructorParameters<typeof RedeemInvite>[0]["followReader"],
    blockReader: ConstructorParameters<typeof RedeemInvite>[0]["blockReader"],
    friendshipEstablisher: ConstructorParameters<typeof RedeemInvite>[0]["friendshipEstablisher"],
    claimHasher: ConstructorParameters<typeof RedeemInvite>[0]["claimHasher"],
    notifier: ConstructorParameters<typeof RedeemInvite>[0]["notifier"],
    rewardScheduler: ConstructorParameters<typeof RedeemInvite>[0]["rewardScheduler"],
    inviteConfig: ConstructorParameters<typeof RedeemInvite>[0]["inviteConfig"],
    mutationLock: ConstructorParameters<typeof RedeemInvite>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof RedeemInvite>[0]["unitOfWork"],
    premiumGranter: ConstructorParameters<typeof RedeemInvite>[0]["premiumGranter"],
  ) =>
    new RedeemInvite({
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
      logger: new Logger(RedeemInvite.name),
    }),
};

export const recordInviteeActivityProvider: FactoryProvider<RecordInviteeActivity> = {
  provide: RecordInviteeActivity,
  inject: [
    INVITE_REDEMPTION_REPOSITORY,
    REWARD_GRANT_REPOSITORY,
    INVITE_REWARD_SCHEDULER,
    INVITE_CONFIG,
    MUTATION_LOCK,
    UNIT_OF_WORK,
  ],
  useFactory: (
    inviteRedemptionRepository: ConstructorParameters<
      typeof RecordInviteeActivity
    >[0]["inviteRedemptionRepository"],
    rewardGrantRepository: ConstructorParameters<
      typeof RecordInviteeActivity
    >[0]["rewardGrantRepository"],
    rewardScheduler: ConstructorParameters<typeof RecordInviteeActivity>[0]["rewardScheduler"],
    inviteConfig: ConstructorParameters<typeof RecordInviteeActivity>[0]["inviteConfig"],
    mutationLock: ConstructorParameters<typeof RecordInviteeActivity>[0]["mutationLock"],
    unitOfWork: ConstructorParameters<typeof RecordInviteeActivity>[0]["unitOfWork"],
  ) =>
    new RecordInviteeActivity({
      inviteRedemptionRepository,
      rewardGrantRepository,
      rewardScheduler,
      inviteConfig,
      mutationLock,
      unitOfWork,
      logger: new Logger(RecordInviteeActivity.name),
    }),
};

export const grantInviteRewardsProvider: FactoryProvider<GrantInviteRewards> = {
  provide: GrantInviteRewards,
  inject: [
    REWARD_GRANT_REPOSITORY,
    INVITE_REDEMPTION_REPOSITORY,
    REWARD_APPLIERS,
    INVITE_NOTIFIER,
    INVITE_REWARD_ALERT,
    INVITE_CONFIG,
    UNIT_OF_WORK,
  ],
  useFactory: (
    rewardGrantRepository: ConstructorParameters<
      typeof GrantInviteRewards
    >[0]["rewardGrantRepository"],
    inviteRedemptionRepository: ConstructorParameters<
      typeof GrantInviteRewards
    >[0]["inviteRedemptionRepository"],
    rewardAppliers: ConstructorParameters<typeof GrantInviteRewards>[0]["rewardAppliers"],
    notifier: ConstructorParameters<typeof GrantInviteRewards>[0]["notifier"],
    alert: ConstructorParameters<typeof GrantInviteRewards>[0]["alert"],
    inviteConfig: ConstructorParameters<typeof GrantInviteRewards>[0]["inviteConfig"],
    unitOfWork: ConstructorParameters<typeof GrantInviteRewards>[0]["unitOfWork"],
  ) =>
    new GrantInviteRewards({
      rewardGrantRepository,
      inviteRedemptionRepository,
      rewardAppliers,
      notifier,
      alert,
      inviteConfig,
      unitOfWork,
      logger: new Logger(GrantInviteRewards.name),
    }),
};

export const expireStaleRedemptionsProvider: FactoryProvider<ExpireStaleRedemptions> = {
  provide: ExpireStaleRedemptions,
  inject: [
    INVITE_REDEMPTION_REPOSITORY,
    REWARD_GRANT_REPOSITORY,
    INVITE_REWARD_SCHEDULER,
    INVITE_CONFIG,
    UNIT_OF_WORK,
  ],
  useFactory: (
    inviteRedemptionRepository: ConstructorParameters<
      typeof ExpireStaleRedemptions
    >[0]["inviteRedemptionRepository"],
    rewardGrantRepository: ConstructorParameters<
      typeof ExpireStaleRedemptions
    >[0]["rewardGrantRepository"],
    rewardScheduler: ConstructorParameters<typeof ExpireStaleRedemptions>[0]["rewardScheduler"],
    inviteConfig: ConstructorParameters<typeof ExpireStaleRedemptions>[0]["inviteConfig"],
    unitOfWork: ConstructorParameters<typeof ExpireStaleRedemptions>[0]["unitOfWork"],
  ) =>
    new ExpireStaleRedemptions({
      inviteRedemptionRepository,
      rewardGrantRepository,
      rewardScheduler,
      inviteConfig,
      unitOfWork,
      logger: new Logger(ExpireStaleRedemptions.name),
    }),
};
