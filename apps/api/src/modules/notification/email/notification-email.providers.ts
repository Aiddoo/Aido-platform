import { Logger, type FactoryProvider } from "@nestjs/common";

import {
  USAGE_METER,
  type UsageMeterPort,
} from "#api/platform/metering/interfaces/usage-meter.interface";
import {
  OPERATIONAL_ALERT,
  type OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

import { EMAIL_BUDGET_PORT, type EmailBudgetPort } from "./application/ports/email-budget.port.js";
import { EMAIL_DELIVERY_QUEUE_PORT } from "./application/ports/email-delivery-queue.port.js";
import { EMAIL_SENDER } from "./application/ports/email-sender.port.js";
import { DeliverEmailUseCase } from "./application/use-cases/deliver-email.use-case.js";
import { SendTransactionalEmailUseCase } from "./application/use-cases/send-transactional-email.use-case.js";
import { MeteredEmailBudgetAdapter } from "./infrastructure/adapters/metered-email-budget.adapter.js";

export const emailBudgetProvider: FactoryProvider<EmailBudgetPort> = {
  provide: EMAIL_BUDGET_PORT,
  inject: [USAGE_METER, OPERATIONAL_ALERT],
  useFactory: (meter: UsageMeterPort, alert: OperationalAlertPort) =>
    new MeteredEmailBudgetAdapter({
      meter,
      alert,
      logger: new Logger(MeteredEmailBudgetAdapter.name),
    }),
};

export const sendTransactionalEmailUseCaseProvider: FactoryProvider<SendTransactionalEmailUseCase> =
  {
    provide: SendTransactionalEmailUseCase,
    inject: [EMAIL_DELIVERY_QUEUE_PORT, EMAIL_SENDER, EMAIL_BUDGET_PORT],
    useFactory: (
      queue: ConstructorParameters<typeof SendTransactionalEmailUseCase>[0]["queue"],
      sender: ConstructorParameters<typeof SendTransactionalEmailUseCase>[0]["sender"],
      budget: ConstructorParameters<typeof SendTransactionalEmailUseCase>[0]["budget"],
    ) =>
      new SendTransactionalEmailUseCase({
        queue,
        sender,
        budget,
        logger: new Logger(SendTransactionalEmailUseCase.name),
      }),
  };

export const deliverEmailUseCaseProvider: FactoryProvider<DeliverEmailUseCase> = {
  provide: DeliverEmailUseCase,
  inject: [EMAIL_SENDER, EMAIL_BUDGET_PORT, OPERATIONAL_ALERT],
  useFactory: (
    sender: ConstructorParameters<typeof DeliverEmailUseCase>[0]["sender"],
    budget: ConstructorParameters<typeof DeliverEmailUseCase>[0]["budget"],
    alert: OperationalAlertPort,
  ) =>
    new DeliverEmailUseCase({
      sender,
      budget,
      alert,
      logger: new Logger(DeliverEmailUseCase.name),
    }),
};
