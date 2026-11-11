import { Module } from "@nestjs/common";

import { SupportInquiriesModule } from "./inquiries/support-inquiries.module.js";

@Module({
  imports: [SupportInquiriesModule],
})
export class SupportModule {}
