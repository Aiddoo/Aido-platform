import { Logger, type FactoryProvider } from "@nestjs/common";

import { INQUIRY_MAILER } from "./application/ports/inquiries/inquiry-mailer.port.js";
import { CreateInquiry } from "./application/use-cases/inquiries/create-inquiry.use-case.js";

export const createInquiryProvider: FactoryProvider<CreateInquiry> = {
  provide: CreateInquiry,
  inject: [INQUIRY_MAILER],
  useFactory: (mailer: ConstructorParameters<typeof CreateInquiry>[0]["mailer"]) =>
    new CreateInquiry({ mailer, logger: new Logger(CreateInquiry.name) }),
};
