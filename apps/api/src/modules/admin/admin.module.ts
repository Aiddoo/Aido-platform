import { Module } from "@nestjs/common";

import { NotificationModule } from "../notification/notification.module";
import { AdminController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({
	imports: [NotificationModule],
	controllers: [AdminController],
	providers: [AdminService],
	exports: [AdminService],
})
export class AdminModule {}
