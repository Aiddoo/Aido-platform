import {
	getNudgeInteractionsQuerySchema,
	getNudgeThanksPreviewQuerySchema,
	nudgeTodoIdParamSchema,
	replyToNudgeSchema,
	sendNudgeThanksSchema,
} from "@aido/validators";
import type { z } from "zod";

export const GetNudgeInteractionsQueryDto = getNudgeInteractionsQuerySchema.meta({
	id: "GetNudgeInteractionsQueryDto",
	apiParameter: true,
});
export type GetNudgeInteractionsQueryDto = z.infer<typeof GetNudgeInteractionsQueryDto>;

export const GetNudgeThanksPreviewQueryDto = getNudgeThanksPreviewQuerySchema.meta({
	id: "GetNudgeThanksPreviewQueryDto",
	apiParameter: true,
});
export type GetNudgeThanksPreviewQueryDto = z.infer<typeof GetNudgeThanksPreviewQueryDto>;

export const NudgeTodoIdParamDto = nudgeTodoIdParamSchema.meta({
	id: "NudgeTodoIdParamDto",
	apiParameter: true,
});
export type NudgeTodoIdParamDto = z.infer<typeof NudgeTodoIdParamDto>;

export const ReplyToNudgeDto = replyToNudgeSchema.meta({ id: "ReplyToNudgeDto" });
export type ReplyToNudgeDto = z.infer<typeof ReplyToNudgeDto>;

export const SendNudgeThanksDto = sendNudgeThanksSchema.meta({ id: "SendNudgeThanksDto" });
export type SendNudgeThanksDto = z.infer<typeof SendNudgeThanksDto>;
