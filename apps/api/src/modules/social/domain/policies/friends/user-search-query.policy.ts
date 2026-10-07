import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/exceptions/domain.exception";

export interface NormalizedSearchQuery {
  nfc: string;
  upperTag: string;
}

export function normalizeUserSearchQuery(input: string): NormalizedSearchQuery {
  const nfc = input.normalize("NFC").trim().replace(/\s+/g, " ");
  if (nfc.length === 0) {
    throw new DomainException(ErrorCode.FOLLOW_0911, { query: input });
  }
  return { nfc, upperTag: nfc.toUpperCase() };
}
