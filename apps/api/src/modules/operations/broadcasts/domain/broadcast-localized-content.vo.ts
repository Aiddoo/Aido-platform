import { SUPPORTED_LOCALES, type SupportedLocale } from "@aido/api/vocabulary";

import { ValueObject } from "#api/shared/domain/model/value-object";

import { BroadcastContent, type BroadcastCopy } from "./broadcast-content.vo.js";

export type BroadcastLocalizedCopy = Readonly<Partial<Record<SupportedLocale, BroadcastCopy>>>;

// 언어별 문구. 없는 언어는 캠페인의 기본 title·body로 되돌아가므로 일부 언어만 담을 수 있다
export class BroadcastLocalizedContent extends ValueObject<BroadcastLocalizedCopy> {
  static create(input: BroadcastLocalizedCopy | null | undefined): BroadcastLocalizedContent {
    return new BroadcastLocalizedContent(normalize(input, (copy) => BroadcastContent.create(copy)));
  }

  static reconstitute(input: BroadcastLocalizedCopy | null): BroadcastLocalizedContent {
    return new BroadcastLocalizedContent(
      normalize(input, (copy) => BroadcastContent.reconstitute(copy)),
    );
  }

  get isEmpty(): boolean {
    return Object.keys(this.value).length === 0;
  }

  contentFor(locale: SupportedLocale): BroadcastContent | null {
    const copy = this.value[locale];
    return copy == null ? null : BroadcastContent.reconstitute(copy);
  }
}

function normalize(
  input: BroadcastLocalizedCopy | null | undefined,
  toContent: (copy: BroadcastCopy) => BroadcastContent,
): BroadcastLocalizedCopy {
  if (input == null) {
    return {};
  }
  const entries = SUPPORTED_LOCALES.flatMap((locale) => {
    const copy = input[locale];
    return copy == null ? [] : [[locale, toContent(copy).value] as const];
  });
  return Object.fromEntries(entries);
}
