import { Module } from "@nestjs/common";

import { NotificationEmailModule } from "#api/modules/notification/notification-email.public";

import { InquiryController } from "./presentation/http/v1/inquiry.controller.js";
import { SUPPORT_INQUIRIES_PROVIDERS } from "./support-inquiries.providers.js";

@Module({
  imports: [NotificationEmailModule],
  controllers: [InquiryController],
  providers: [...SUPPORT_INQUIRIES_PROVIDERS],
})
export class SupportInquiriesModule {}
