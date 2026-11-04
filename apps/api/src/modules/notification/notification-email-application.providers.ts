import { Logger, type FactoryProvider } from "@nestjs/common";

import {
  USAGE_METER,
  type UsageMeterPort,
} from "#api/platform/metering/interfaces/usage-meter.interface";
import {
  OPERATIONAL_ALERT,
  type OperationalAlertPort,
} from "#api/shared/application/ports/operational-alert.port";

import {
  EMAIL_BUDGET_PORT,
  type EmailBudgetPort,
} from "./application/ports/email/email-budget.port.js";
import { EMAIL_DELIVERY_QUEUE_PORT } from "./application/ports/email/email-delivery-queue.port.js";
import { EMAIL_SENDER } from "./application/ports/email/email-sender.port.js";
import { TransactionalEmailSender } from "./application/senders/email/transactional-email.sender.js";
import { DeliverEmail } from "./application/use-cases/email/deliver-email.use-case.js";
import { MeteredEmailBudgetAdapter } from "./infrastructure/adapters/email/metered-email-budget.adapter.js";

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

export const transactionalEmailSenderProvider: FactoryProvider<TransactionalEmailSender> = {
  provide: TransactionalEmailSender,
  inject: [EMAIL_DELIVERY_QUEUE_PORT, EMAIL_BUDGET_PORT],
  useFactory: (
    queue: ConstructorParameters<typeof TransactionalEmailSender>[0]["queue"],
    budget: ConstructorParameters<typeof TransactionalEmailSender>[0]["budget"],
  ) =>
    new TransactionalEmailSender({
      queue,
      budget,
      logger: new Logger(TransactionalEmailSender.name),
    }),
};

export const deliverEmailProvider: FactoryProvider<DeliverEmail> = {
  provide: DeliverEmail,
  inject: [EMAIL_SENDER, EMAIL_BUDGET_PORT, OPERATIONAL_ALERT],
  useFactory: (
    sender: ConstructorParameters<typeof DeliverEmail>[0]["sender"],
    budget: ConstructorParameters<typeof DeliverEmail>[0]["budget"],
    alert: OperationalAlertPort,
  ) => new DeliverEmail({ sender, budget, alert, logger: new Logger(DeliverEmail.name) }),
};
