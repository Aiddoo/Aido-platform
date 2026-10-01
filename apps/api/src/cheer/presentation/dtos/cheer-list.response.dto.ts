import {
	cheerDetailSchema,
	receivedCheersResponseSchema,
	sentCheersResponseSchema,
} from "@aido/validators";
import type { z } from "zod";

export const CheerDetailDto = cheerDetailSchema.meta({ id: "CheerDetailDto" });
export type CheerDetailDto = z.infer<typeof CheerDetailDto>;

export const ReceivedCheersResponseDto = receivedCheersResponseSchema.meta({
	id: "ReceivedCheersResponseDto",
});
export type ReceivedCheersResponseDto = z.infer<typeof ReceivedCheersResponseDto>;

export const SentCheersResponseDto = sentCheersResponseSchema.meta({ id: "SentCheersResponseDto" });
export type SentCheersResponseDto = z.infer<typeof SentCheersResponseDto>;
