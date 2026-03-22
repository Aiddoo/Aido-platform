import { Controller, Get, Logger, Param, Res } from "@nestjs/common";
import type { Response } from "express";

import { Public } from "@/modules/auth/decorators/public.decorator";

import { InviteService } from "./invite.service";
import { InviteTemplateService } from "./invite.template";

@Controller()
export class InviteController {
	readonly #logger = new Logger(InviteController.name);

	constructor(
		private readonly inviteService: InviteService,
		private readonly templateService: InviteTemplateService,
	) {}

	@Public()
	@Get("invite/:userTag")
	async getInvitePage(
		@Param("userTag") userTag: string,
		@Res() res: Response,
	): Promise<void> {
		if (!/^[A-Z0-9]{8}$/.test(userTag)) {
			this.#logger.debug(`잘못된 userTag 형식: ${userTag}`);
			this.#sendHtml(res, this.templateService.renderErrorPage());
			return;
		}

		const user = await this.inviteService.findUserByTag(userTag);

		this.#logger.debug(`초대 페이지 렌더링: tag=${userTag}, found=${!!user}`);

		this.#sendHtml(res, this.templateService.renderInvitePage(userTag, user));
	}

	#sendHtml(res: Response, html: string): void {
		res.removeHeader("Content-Security-Policy");
		res.setHeader("Content-Type", "text/html; charset=utf-8");
		res.send(html);
	}
}
