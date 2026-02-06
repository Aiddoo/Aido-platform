import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export const Timezone = createParamDecorator(
	(_data: unknown, ctx: ExecutionContext): string => {
		const request = ctx.switchToHttp().getRequest();
		return request.headers["x-timezone"] || "UTC";
	},
);
