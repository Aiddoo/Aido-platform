import { Module } from "@nestjs/common";
import { EmailModule } from "@/email/email.module";
import { InquiryController } from "./inquiry.controller";
import { InquiryService } from "./inquiry.service";

@Module({
	imports: [EmailModule],
	controllers: [InquiryController],
	providers: [InquiryService],
})
export class InquiryModule {}
