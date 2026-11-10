import { Logger, Module } from "@nestjs/common";

import { NotificationEmailModule } from "#api/modules/notification/notification-email.public";

import { INQUIRY_MAILER } from "./application/ports/inquiry-mailer.port.js";
import { CreateInquiry } from "./application/use-cases/create-inquiry.use-case.js";
import { EmailInquiryMailerAdapter } from "./infrastructure/adapters/email-inquiry-mailer.adapter.js";
import { InquiryController } from "./presentation/http/v1/inquiry.controller.js";

@Module({
  imports: [NotificationEmailModule],
  controllers: [InquiryController],
  providers: [
    { provide: INQUIRY_MAILER, useClass: EmailInquiryMailerAdapter },
    {
      provide: CreateInquiry,
      inject: [INQUIRY_MAILER],
      useFactory: (mailer: ConstructorParameters<typeof CreateInquiry>[0]["mailer"]) =>
        new CreateInquiry({ mailer, logger: new Logger(CreateInquiry.name) }),
    },
  ],
})
export class SupportInquiriesModule {}
