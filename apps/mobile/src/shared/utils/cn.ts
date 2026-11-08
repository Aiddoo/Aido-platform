import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

import { type CustomClassGroupIds, TAILWIND_MERGE_CONFIG } from './tailwind-merge-config';

const customTwMerge = extendTailwindMerge<CustomClassGroupIds>(TAILWIND_MERGE_CONFIG);

export function cn(...inputs: ClassValue[]) {
  return customTwMerge(clsx(inputs));
}
