import { z } from 'zod';

export const routeIntegerStringSchema = z
  .string()
  .regex(/^[1-9]\d*$/)
  .transform((value): unknown => value);

export function parseWebViewUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const parseHttpUrl = (candidate: string) => {
    try {
      const url = new URL(candidate);
      return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
    } catch {
      return null;
    }
  };

  const directUrl = parseHttpUrl(value);
  if (directUrl) return directUrl;

  try {
    return parseHttpUrl(decodeURIComponent(value));
  } catch {
    return null;
  }
}
