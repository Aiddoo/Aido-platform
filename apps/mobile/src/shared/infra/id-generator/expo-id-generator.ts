import type { IdGenerator } from '@src/core/ports/id-generator';
import { randomUUID } from 'expo-crypto';

export const expoIdGenerator: IdGenerator = {
  create: () => randomUUID(),
};
