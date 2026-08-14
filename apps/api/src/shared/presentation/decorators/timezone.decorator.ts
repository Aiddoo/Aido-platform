import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

import { normalizeIanaTimezone } from "@/shared/domain/date/utils/timezone";

export interface TimezoneDecoratorOptions {
	/** 헤더 누락/오류 시 UTC를 쓰지 않고 기존 저장값을 유지한다. */
	readonly preserveIfMissing?: boolean;
}

export function parseTimezoneHeader(
	header: unknown,
	options: TimezoneDecoratorOptions = {},
): string | undefined {
	const normalized = normalizeIanaTimezone(header);
	if (normalized) return normalized;
	return options.preserveIfMissing ? undefined : "UTC";
}

export const Timezone = createParamDecorator<
	TimezoneDecoratorOptions | undefined,
	string | undefined
>((data, ctx: ExecutionContext): string | undefined => {
	const request = ctx.switchToHttp().getRequest();
	return parseTimezoneHeader(request.headers["x-timezone"], data);
});
