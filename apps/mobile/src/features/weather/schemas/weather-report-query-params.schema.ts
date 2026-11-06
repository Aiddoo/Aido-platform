import { z } from 'zod';

export const weatherReportQueryParamsSchema = z.object({ locationRevision: z.number() });
