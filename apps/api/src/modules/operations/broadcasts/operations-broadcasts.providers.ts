import { Logger, type FactoryProvider } from "@nestjs/common";

import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { ADMIN_BROADCAST_NOTIFIER } from "./application/ports/admin-broadcast-notifier.port.js";
import { ADMIN_USER_DIRECTORY } from "./application/ports/admin-user-directory.reader.port.js";
import { BROADCAST_CAMPAIGN_REPOSITORY } from "./application/ports/broadcast-campaign.repository.port.js";
import { BROADCAST_DELIVERY_OUTCOME_READER } from "./application/ports/broadcast-delivery-outcome.reader.port.js";
import { BROADCAST_FAN_OUT_ENQUEUER } from "./application/ports/broadcast-fan-out-enqueuer.port.js";
import { BroadcastNotificationUseCase } from "./application/use-cases/broadcast-notification.use-case.js";
import { CreateBroadcastCampaignUseCase } from "./application/use-cases/create-broadcast-campaign.use-case.js";
import { FailBroadcastCampaignUseCase } from "./application/use-cases/fail-broadcast-campaign.use-case.js";
import { FanOutBroadcastCampaignUseCase } from "./application/use-cases/fan-out-broadcast-campaign.use-case.js";
import { GetBroadcastCampaignUseCase } from "./application/use-cases/get-broadcast-campaign.use-case.js";
import { SendTargetedNotificationUseCase } from "./application/use-cases/send-targeted-notification.use-case.js";

type Dependencies<T extends abstract new (...args: never) => unknown> = ConstructorParameters<T>[0];

export const createBroadcastCampaignProvider: FactoryProvider<CreateBroadcastCampaignUseCase> = {
  provide: CreateBroadcastCampaignUseCase,
  inject: [
    BROADCAST_CAMPAIGN_REPOSITORY,
    ADMIN_USER_DIRECTORY,
    BROADCAST_FAN_OUT_ENQUEUER,
    UNIT_OF_WORK,
  ],
  useFactory: (
    repository: Dependencies<typeof CreateBroadcastCampaignUseCase>["repository"],
    userDirectory: Dependencies<typeof CreateBroadcastCampaignUseCase>["userDirectory"],
    fanOutEnqueuer: Dependencies<typeof CreateBroadcastCampaignUseCase>["fanOutEnqueuer"],
    unitOfWork: Dependencies<typeof CreateBroadcastCampaignUseCase>["unitOfWork"],
  ) =>
    new CreateBroadcastCampaignUseCase({
      repository,
      userDirectory,
      fanOutEnqueuer,
      unitOfWork,
      logger: new Logger(CreateBroadcastCampaignUseCase.name),
    }),
};

export const broadcastNotificationProvider: FactoryProvider<BroadcastNotificationUseCase> = {
  provide: BroadcastNotificationUseCase,
  inject: [CreateBroadcastCampaignUseCase],
  useFactory: (
    createBroadcastCampaign: Dependencies<
      typeof BroadcastNotificationUseCase
    >["createBroadcastCampaign"],
  ) => new BroadcastNotificationUseCase({ createBroadcastCampaign }),
};

export const fanOutBroadcastCampaignProvider: FactoryProvider<FanOutBroadcastCampaignUseCase> = {
  provide: FanOutBroadcastCampaignUseCase,
  inject: [
    BROADCAST_CAMPAIGN_REPOSITORY,
    ADMIN_USER_DIRECTORY,
    ADMIN_BROADCAST_NOTIFIER,
    BROADCAST_FAN_OUT_ENQUEUER,
    UNIT_OF_WORK,
  ],
  useFactory: (
    repository: Dependencies<typeof FanOutBroadcastCampaignUseCase>["repository"],
    userDirectory: Dependencies<typeof FanOutBroadcastCampaignUseCase>["userDirectory"],
    notifier: Dependencies<typeof FanOutBroadcastCampaignUseCase>["notifier"],
    fanOutEnqueuer: Dependencies<typeof FanOutBroadcastCampaignUseCase>["fanOutEnqueuer"],
    unitOfWork: Dependencies<typeof FanOutBroadcastCampaignUseCase>["unitOfWork"],
  ) =>
    new FanOutBroadcastCampaignUseCase({
      repository,
      userDirectory,
      notifier,
      fanOutEnqueuer,
      unitOfWork,
      logger: new Logger(FanOutBroadcastCampaignUseCase.name),
    }),
};

export const failBroadcastCampaignProvider: FactoryProvider<FailBroadcastCampaignUseCase> = {
  provide: FailBroadcastCampaignUseCase,
  inject: [BROADCAST_CAMPAIGN_REPOSITORY, UNIT_OF_WORK],
  useFactory: (
    repository: Dependencies<typeof FailBroadcastCampaignUseCase>["repository"],
    unitOfWork: Dependencies<typeof FailBroadcastCampaignUseCase>["unitOfWork"],
  ) =>
    new FailBroadcastCampaignUseCase({
      repository,
      unitOfWork,
      logger: new Logger(FailBroadcastCampaignUseCase.name),
    }),
};

export const getBroadcastCampaignProvider: FactoryProvider<GetBroadcastCampaignUseCase> = {
  provide: GetBroadcastCampaignUseCase,
  inject: [BROADCAST_CAMPAIGN_REPOSITORY, BROADCAST_DELIVERY_OUTCOME_READER],
  useFactory: (
    repository: Dependencies<typeof GetBroadcastCampaignUseCase>["repository"],
    outcomeReader: Dependencies<typeof GetBroadcastCampaignUseCase>["outcomeReader"],
  ) => new GetBroadcastCampaignUseCase({ repository, outcomeReader }),
};

export const sendTargetedNotificationProvider: FactoryProvider<SendTargetedNotificationUseCase> = {
  provide: SendTargetedNotificationUseCase,
  inject: [ADMIN_USER_DIRECTORY, ADMIN_BROADCAST_NOTIFIER],
  useFactory: (
    userDirectory: Dependencies<typeof SendTargetedNotificationUseCase>["userDirectory"],
    notifier: Dependencies<typeof SendTargetedNotificationUseCase>["notifier"],
  ) =>
    new SendTargetedNotificationUseCase({
      userDirectory,
      notifier,
      logger: new Logger(SendTargetedNotificationUseCase.name),
    }),
};
