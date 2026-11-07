import { z } from 'zod';

export const weatherReportQueryKeySchema = z.object({ locationRevision: z.number() });
