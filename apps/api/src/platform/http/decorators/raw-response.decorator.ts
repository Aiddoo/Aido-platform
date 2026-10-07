import { SetMetadata } from "@nestjs/common";

export const RAW_RESPONSE_KEY = "rawResponse";

/**
 * Excludes a narrowly scoped endpoint from the global success-response wrapper.
 */
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);
