import { z } from "zod";

export const kmaResponseItemSchema = z.object({
  category: z.string(),
  fcstDate: z.string(),
  fcstTime: z.string(),
  fcstValue: z.string(),
});

export const kmaApiResponseSchema = z.object({
  response: z.object({
    header: z.object({
      resultCode: z.string().min(1),
      resultMsg: z.string().optional(),
    }),
    body: z
      .object({ items: z.object({ item: z.array(kmaResponseItemSchema).optional() }).optional() })
      .optional(),
  }),
});

export type KmaResponseItem = z.infer<typeof kmaResponseItemSchema>;
export type KmaApiResponse = z.infer<typeof kmaApiResponseSchema>;
