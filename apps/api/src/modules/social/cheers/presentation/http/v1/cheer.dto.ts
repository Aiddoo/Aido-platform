import {
  cheerCooldownInfoSchema,
  cheerIdParamSchema,
  cheerLimitInfoSchema,
  createCheerResponseSchema,
  markCheerReadResponseSchema,
  receivedCheersResponseSchema,
  sentCheersResponseSchema,
  getCheersQuerySchema,
  createCheerSchema,
  markCheersReadSchema,
} from "@aido/api";
import type { z } from "zod";

export const CheerCooldownResponseDto = cheerCooldownInfoSchema.meta({
  id: "CheerCooldownResponseDto",
});
export type CheerCooldownResponseDto = z.infer<typeof CheerCooldownResponseDto>;

export const CheerIdParamDto = cheerIdParamSchema.meta({
  id: "CheerIdParamDto",
  apiParameter: true,
});
export type CheerIdParamDto = z.infer<typeof CheerIdParamDto>;

export const CheerLimitInfoDto = cheerLimitInfoSchema.meta({ id: "CheerLimitInfoDto" });
export type CheerLimitInfoDto = z.infer<typeof CheerLimitInfoDto>;

export const CreateCheerResponseDto = createCheerResponseSchema.meta({
  id: "CreateCheerResponseDto",
});
export type CreateCheerResponseDto = z.infer<typeof CreateCheerResponseDto>;

export const MarkCheerReadResponseDto = markCheerReadResponseSchema.meta({
  id: "MarkCheerReadResponseDto",
});
export type MarkCheerReadResponseDto = z.infer<typeof MarkCheerReadResponseDto>;

export const ReceivedCheersResponseDto = receivedCheersResponseSchema.meta({
  id: "ReceivedCheersResponseDto",
});
export type ReceivedCheersResponseDto = z.infer<typeof ReceivedCheersResponseDto>;

export const SentCheersResponseDto = sentCheersResponseSchema.meta({ id: "SentCheersResponseDto" });
export type SentCheersResponseDto = z.infer<typeof SentCheersResponseDto>;

export const GetCheersQueryDto = getCheersQuerySchema.meta({
  id: "GetCheersQueryDto",
  apiParameter: true,
});
export type GetCheersQueryDto = z.infer<typeof GetCheersQueryDto>;

export const SendCheerDto = createCheerSchema.meta({ id: "SendCheerDto" });
export type SendCheerDto = z.infer<typeof SendCheerDto>;

export const MarkCheersReadDto = markCheersReadSchema.meta({ id: "MarkCheersReadDto" });
export type MarkCheersReadDto = z.infer<typeof MarkCheersReadDto>;
