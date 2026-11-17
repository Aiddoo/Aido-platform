import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { NotificationEmailMessagesModule } from "#api/modules/notification/email-messages/notification-email-messages.public";

import { InquiryController } from "./presentation/http/v1/inquiry.controller.js";
import { supportInquiriesConfig } from "./support-inquiries.config.js";
import { SUPPORT_INQUIRIES_PROVIDERS } from "./support-inquiries.providers.js";

@Module({
  imports: [NotificationEmailMessagesModule, ConfigModule.forFeature(supportInquiriesConfig)],
  controllers: [InquiryController],
  providers: [...SUPPORT_INQUIRIES_PROVIDERS],
})
export class SupportInquiriesModule {}
