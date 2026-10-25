import { Logger, type FactoryProvider } from "@nestjs/common";

import { MUTATION_LOCK, UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { INVITE_REDEMPTION_REPOSITORY } from "./application/ports/invites/invite-redemption.repository.port.js";
import { INVITE_CONFIG } from "./application/ports/invites/invite.config.port.js";
import { INVITE_REPOSITORY } from "./application/ports/invites/invite.repository.port.js";
import { REWARD_GRANT_REPOSITORY } from "./application/ports/invites/reward-grant.repository.port.js";
import { MyInviteReader } from "./application/services/invites/my-invite.reader.js";
import { GetInviteAvailability } from "./application/use-cases/invites/get-invite-availability.use-case.js";
import { GetInvitedFriends } from "./application/use-cases/invites/get-invited-friends.use-case.js";
import { GetMyInvite } from "./application/use-cases/invites/get-my-invite.use-case.js";
import { PreviewInvite } from "./application/use-cases/invites/preview-invite.use-case.js";
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
