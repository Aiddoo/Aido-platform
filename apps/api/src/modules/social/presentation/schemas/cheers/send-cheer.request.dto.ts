import { createCheerSchema, markCheerReadSchema, markCheersReadSchema } from "@aido/api";
import type { z } from "zod";

export const SendCheerDto = createCheerSchema.meta({ id: "SendCheerDto" });
export type SendCheerDto = z.infer<typeof SendCheerDto>;

export const MarkCheerReadDto = markCheerReadSchema.meta({ id: "MarkCheerReadDto" });
export type MarkCheerReadDto = z.infer<typeof MarkCheerReadDto>;

export const MarkCheersReadDto = markCheersReadSchema.meta({ id: "MarkCheersReadDto" });
export type MarkCheersReadDto = z.infer<typeof MarkCheersReadDto>;
