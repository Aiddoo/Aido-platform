import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { NotificationEmailModule } from "#api/modules/notification/notification-email.public";

import { InquiryController } from "./presentation/http/v1/inquiry.controller.js";
import { supportInquiriesConfig } from "./support-inquiries.config.js";
import { SUPPORT_INQUIRIES_PROVIDERS } from "./support-inquiries.providers.js";

@Module({
  imports: [NotificationEmailModule, ConfigModule.forFeature(supportInquiriesConfig)],
  controllers: [InquiryController],
  providers: [...SUPPORT_INQUIRIES_PROVIDERS],
})
export class SupportInquiriesModule {}
