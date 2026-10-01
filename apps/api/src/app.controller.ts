import { Controller, Get } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";

import { Public } from "#api/auth/presentation/decorators/index";

import { AppService } from "./app.service.js";

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
