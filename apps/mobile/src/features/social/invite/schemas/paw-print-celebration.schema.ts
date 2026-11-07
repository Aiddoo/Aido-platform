import { z } from 'zod';

/** 저장된 값이 없거나 깨졌으면 아직 하나도 축하하지 않은 것으로 읽는다 */
export const celebratedCountSchema = z.coerce.number().int().nonnegative().catch(0);
