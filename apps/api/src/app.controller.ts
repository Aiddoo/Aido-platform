import { Controller, Get } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { Public } from "@/auth/presentation/decorators/public.decorator";
import { AppService } from "./app.service";

@ApiExcludeController()
@Controller()
export class AppController {
	constructor(private readonly appService: AppService) {}

	@Get()
	@Public()
	getHello(): string {
		return this.appService.getHello();
	}
}
