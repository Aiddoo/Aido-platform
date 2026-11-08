import { z } from 'zod';

export const weatherRescheduleFormSchema = z.object({
  selections: z.record(z.string(), z.iso.datetime()),
});

export type WeatherRescheduleFormValues = z.infer<typeof weatherRescheduleFormSchema>;
