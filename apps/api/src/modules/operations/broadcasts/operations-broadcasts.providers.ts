import type { Provider } from "@nestjs/common";

import { loggerFor, provideUseCase } from "#api/platform/di/provide-use-case";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { AdminBroadcastNotifierPort } from "./application/ports/admin-broadcast-notifier.port.js";
import { AdminUserDirectoryReaderPort } from "./application/ports/admin-user-directory.reader.port.js";
import { BroadcastCampaignRepositoryPort } from "./application/ports/broadcast-campaign.repository.port.js";
import { BroadcastDeliveryOutcomeReaderPort } from "./application/ports/broadcast-delivery-outcome.reader.port.js";
import { BroadcastJobEnqueuerPort } from "./application/ports/broadcast-job-enqueuer.port.js";
import { BroadcastRecipientReaderPort } from "./application/ports/broadcast-recipient.reader.port.js";
import { BroadcastNotificationUseCase } from "./application/use-cases/broadcast-notification.use-case.js";
import { CreateBroadcastCampaignUseCase } from "./application/use-cases/create-broadcast-campaign.use-case.js";
import { DeliverBroadcastGroupUseCase } from "./application/use-cases/deliver-broadcast-group.use-case.js";
import { FailBroadcastCampaignUseCase } from "./application/use-cases/fail-broadcast-campaign.use-case.js";
import { FanOutBroadcastCampaignUseCase } from "./application/use-cases/fan-out-broadcast-campaign.use-case.js";
import { GetBroadcastCampaignUseCase } from "./application/use-cases/get-broadcast-campaign.use-case.js";
import { ReportBroadcastDeliveryExhaustedUseCase } from "./application/use-cases/report-broadcast-delivery-exhausted.use-case.js";
import { SendTargetedNotificationUseCase } from "./application/use-cases/send-targeted-notification.use-case.js";
import { BroadcastJobEnqueuerAdapter } from "./infrastructure/adapters/broadcast-job-enqueuer.adapter.js";
import { NotificationAdminBroadcastNotifierAdapter } from "./infrastructure/adapters/notification-admin-broadcast-notifier.adapter.js";
import { NotificationBroadcastDeliveryOutcomeAdapter } from "./infrastructure/adapters/notification-broadcast-delivery-outcome.adapter.js";
import { NotificationBroadcastRecipientAdapter } from "./infrastructure/adapters/notification-broadcast-recipient.adapter.js";
import { BroadcastDeliveryProcessor } from "./infrastructure/jobs/broadcast-delivery.processor.js";
import { BroadcastFanOutProcessor } from "./infrastructure/jobs/broadcast-fan-out.processor.js";
import { DrizzleAdminUserDirectoryReader } from "./infrastructure/persistence/drizzle-admin-user-directory.reader.js";
import { DrizzleBroadcastCampaignRepository } from "./infrastructure/persistence/drizzle-broadcast-campaign.repository.js";

export const OPERATIONS_BROADCASTS_PROVIDERS = [
  { provide: AdminUserDirectoryReaderPort, useClass: DrizzleAdminUserDirectoryReader },
  { provide: AdminBroadcastNotifierPort, useClass: NotificationAdminBroadcastNotifierAdapter },
  { provide: BroadcastRecipientReaderPort, useClass: NotificationBroadcastRecipientAdapter },
  {
    provide: BroadcastDeliveryOutcomeReaderPort,
    useClass: NotificationBroadcastDeliveryOutcomeAdapter,
  },
  { provide: BroadcastCampaignRepositoryPort, useClass: DrizzleBroadcastCampaignRepository },
  { provide: BroadcastJobEnqueuerPort, useClass: BroadcastJobEnqueuerAdapter },
  provideUseCase(CreateBroadcastCampaignUseCase, {
    unitOfWork: UnitOfWorkPort,
    campaignRepository: BroadcastCampaignRepositoryPort,
    userDirectory: AdminUserDirectoryReaderPort,
    jobEnqueuer: BroadcastJobEnqueuerPort,
    clock: ClockPort,
    logger: loggerFor(CreateBroadcastCampaignUseCase),
  }),
  provideUseCase(BroadcastNotificationUseCase, {
    createBroadcastCampaign: CreateBroadcastCampaignUseCase,
  }),
  provideUseCase(FanOutBroadcastCampaignUseCase, {
    unitOfWork: UnitOfWorkPort,
    campaignRepository: BroadcastCampaignRepositoryPort,
    userDirectory: AdminUserDirectoryReaderPort,
    recipientReader: BroadcastRecipientReaderPort,
    notifier: AdminBroadcastNotifierPort,
    jobEnqueuer: BroadcastJobEnqueuerPort,
    clock: ClockPort,
    logger: loggerFor(FanOutBroadcastCampaignUseCase),
  }),
  provideUseCase(DeliverBroadcastGroupUseCase, {
    unitOfWork: UnitOfWorkPort,
    campaignRepository: BroadcastCampaignRepositoryPort,
    recipientReader: BroadcastRecipientReaderPort,
    notifier: AdminBroadcastNotifierPort,
    logger: loggerFor(DeliverBroadcastGroupUseCase),
  }),
  provideUseCase(FailBroadcastCampaignUseCase, {
    unitOfWork: UnitOfWorkPort,
    campaignRepository: BroadcastCampaignRepositoryPort,
    clock: ClockPort,
    logger: loggerFor(FailBroadcastCampaignUseCase),
  }),
  provideUseCase(ReportBroadcastDeliveryExhaustedUseCase, { alert: OperationalAlertPort }),
  provideUseCase(GetBroadcastCampaignUseCase, {
    campaignRepository: BroadcastCampaignRepositoryPort,
    outcomeReader: BroadcastDeliveryOutcomeReaderPort,
  }),
  provideUseCase(SendTargetedNotificationUseCase, {
    userDirectory: AdminUserDirectoryReaderPort,
    notifier: AdminBroadcastNotifierPort,
    logger: loggerFor(SendTargetedNotificationUseCase),
  }),
  BroadcastFanOutProcessor,
  BroadcastDeliveryProcessor,
] satisfies Provider[];
