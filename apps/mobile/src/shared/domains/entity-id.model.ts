import { ENTITY_ID_PATTERN } from '@aido/api/vocabulary';
import { z } from 'zod';

export const entityIdSchema = z.string().regex(ENTITY_ID_PATTERN);
