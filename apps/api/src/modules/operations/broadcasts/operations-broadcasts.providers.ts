import { Logger, type FactoryProvider } from "@nestjs/common";

import { UNIT_OF_WORK } from "#api/shared/application/ports/index";

import { ADMIN_BROADCAST_NOTIFIER } from "./application/ports/admin-broadcast-notifier.port.js";
import { ADMIN_USER_DIRECTORY } from "./application/ports/admin-user-directory.reader.port.js";
import { BROADCAST_CAMPAIGN_REPOSITORY } from "./application/ports/broadcast-campaign.repository.port.js";
import { BROADCAST_DELIVERY_OUTCOME_READER } from "./application/ports/broadcast-delivery-outcome.reader.port.js";
import { BROADCAST_FAN_OUT_ENQUEUER } from "./application/ports/broadcast-fan-out-enqueuer.port.js";
import { BroadcastNotification } from "./application/use-cases/broadcast-notification.use-case.js";
import { CreateBroadcastCampaign } from "./application/use-cases/create-broadcast-campaign.use-case.js";
import { FailBroadcastCampaign } from "./application/use-cases/fail-broadcast-campaign.use-case.js";
import { FanOutBroadcastCampaign } from "./application/use-cases/fan-out-broadcast-campaign.use-case.js";
import { GetBroadcastCampaign } from "./application/use-cases/get-broadcast-campaign.use-case.js";
import { SendTargetedNotification } from "./application/use-cases/send-targeted-notification.use-case.js";

type Dependencies<T extends abstract new (...args: never) => unknown> = ConstructorParameters<T>[0];

export const createBroadcastCampaignProvider: FactoryProvider<CreateBroadcastCampaign> = {
  provide: CreateBroadcastCampaign,
  inject: [
    BROADCAST_CAMPAIGN_REPOSITORY,
    ADMIN_USER_DIRECTORY,
    BROADCAST_FAN_OUT_ENQUEUER,
    UNIT_OF_WORK,
  ],
  useFactory: (
    repository: Dependencies<typeof CreateBroadcastCampaign>["repository"],
    userDirectory: Dependencies<typeof CreateBroadcastCampaign>["userDirectory"],
    fanOutEnqueuer: Dependencies<typeof CreateBroadcastCampaign>["fanOutEnqueuer"],
    unitOfWork: Dependencies<typeof CreateBroadcastCampaign>["unitOfWork"],
  ) =>
    new CreateBroadcastCampaign({
      repository,
      userDirectory,
      fanOutEnqueuer,
      unitOfWork,
      logger: new Logger(CreateBroadcastCampaign.name),
    }),
};

export const broadcastNotificationProvider: FactoryProvider<BroadcastNotification> = {
  provide: BroadcastNotification,
  inject: [CreateBroadcastCampaign],
  useFactory: (
    createBroadcastCampaign: Dependencies<typeof BroadcastNotification>["createBroadcastCampaign"],
  ) => new BroadcastNotification({ createBroadcastCampaign }),
};

export const fanOutBroadcastCampaignProvider: FactoryProvider<FanOutBroadcastCampaign> = {
  provide: FanOutBroadcastCampaign,
  inject: [
    BROADCAST_CAMPAIGN_REPOSITORY,
    ADMIN_USER_DIRECTORY,
    ADMIN_BROADCAST_NOTIFIER,
    BROADCAST_FAN_OUT_ENQUEUER,
    UNIT_OF_WORK,
  ],
  useFactory: (
    repository: Dependencies<typeof FanOutBroadcastCampaign>["repository"],
    userDirectory: Dependencies<typeof FanOutBroadcastCampaign>["userDirectory"],
    notifier: Dependencies<typeof FanOutBroadcastCampaign>["notifier"],
    fanOutEnqueuer: Dependencies<typeof FanOutBroadcastCampaign>["fanOutEnqueuer"],
    unitOfWork: Dependencies<typeof FanOutBroadcastCampaign>["unitOfWork"],
  ) =>
    new FanOutBroadcastCampaign({
      repository,
      userDirectory,
      notifier,
      fanOutEnqueuer,
      unitOfWork,
      logger: new Logger(FanOutBroadcastCampaign.name),
    }),
};

export const failBroadcastCampaignProvider: FactoryProvider<FailBroadcastCampaign> = {
  provide: FailBroadcastCampaign,
  inject: [BROADCAST_CAMPAIGN_REPOSITORY, UNIT_OF_WORK],
  useFactory: (
    repository: Dependencies<typeof FailBroadcastCampaign>["repository"],
    unitOfWork: Dependencies<typeof FailBroadcastCampaign>["unitOfWork"],
  ) =>
    new FailBroadcastCampaign({
      repository,
      unitOfWork,
      logger: new Logger(FailBroadcastCampaign.name),
    }),
};

export const getBroadcastCampaignProvider: FactoryProvider<GetBroadcastCampaign> = {
  provide: GetBroadcastCampaign,
  inject: [BROADCAST_CAMPAIGN_REPOSITORY, BROADCAST_DELIVERY_OUTCOME_READER],
  useFactory: (
    repository: Dependencies<typeof GetBroadcastCampaign>["repository"],
    outcomeReader: Dependencies<typeof GetBroadcastCampaign>["outcomeReader"],
  ) => new GetBroadcastCampaign({ repository, outcomeReader }),
};

export const sendTargetedNotificationProvider: FactoryProvider<SendTargetedNotification> = {
  provide: SendTargetedNotification,
  inject: [ADMIN_USER_DIRECTORY, ADMIN_BROADCAST_NOTIFIER],
  useFactory: (
    userDirectory: Dependencies<typeof SendTargetedNotification>["userDirectory"],
    notifier: Dependencies<typeof SendTargetedNotification>["notifier"],
  ) =>
    new SendTargetedNotification({
      userDirectory,
      notifier,
      logger: new Logger(SendTargetedNotification.name),
    }),
};
