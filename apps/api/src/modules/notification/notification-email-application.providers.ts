import { type FactoryProvider } from "@nestjs/common";

import { EMAIL_SENDER } from "./application/ports/email/email-sender.port.js";
import { TransactionalEmailSender } from "./application/senders/email/transactional-email.sender.js";

export const transactionalEmailSenderProvider: FactoryProvider<TransactionalEmailSender> = {
  provide: TransactionalEmailSender,
  inject: [EMAIL_SENDER],
  useFactory: (
    emailSender: ConstructorParameters<typeof TransactionalEmailSender>[0]["emailSender"],
  ) => new TransactionalEmailSender({ emailSender }),
};
