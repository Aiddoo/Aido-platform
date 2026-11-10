import { z } from "zod";

const kmaResponseItemSchema = z.looseObject({
  category: z.string(),
  fcstDate: z.string(),
  fcstTime: z.string(),
  fcstValue: z.string(),
});

export const kmaApiResponseSchema = z.looseObject({
  response: z.looseObject({
    header: z.looseObject({
      resultCode: z.string().min(1),
      resultMsg: z.string().optional(),
    }),
    body: z
      .object({
        items: z.looseObject({ item: z.array(kmaResponseItemSchema).optional() }).optional(),
      })
      .optional(),
  }),
});

export type KmaResponseItem = z.infer<typeof kmaResponseItemSchema>;
export type KmaApiResponse = z.infer<typeof kmaApiResponseSchema>;
