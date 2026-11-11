import { Controller, Get } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";

import { Public } from "#api/modules/identity/identity-auth-http.public";

import { AppService } from "./app.service.js";

@ApiExcludeController()
@Controller()
export class AppController {
  readonly #appService: AppService;

  constructor(appService: AppService) {
    this.#appService = appService;
  }

  @Get()
  @Public()
  getHello(): string {
    return this.#appService.getHello();
  }
}
