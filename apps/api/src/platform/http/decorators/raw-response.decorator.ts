import { type ExecutionContext, SetMetadata } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";

export const RAW_RESPONSE_KEY = "rawResponse";

/**
 * Excludes a narrowly scoped endpoint from the global success-response wrapper.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);

export function isRawResponse(reflector: Reflector, context: ExecutionContext): boolean {
  return (
    reflector.getAllAndOverride<boolean | undefined>(RAW_RESPONSE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]) === true
  );
}
