import { NOTIFICATION_LIMITS } from "@aido/api/vocabulary";
import { capitalize } from "es-toolkit";
import type { z } from "zod";

import type { SupportedLocale } from "#api/shared/domain/locale";
import { deterministicIndex } from "#api/shared/domain/services/deterministic-variant";

import { EN_NOTIFICATION_GRAMMAR } from "./locales/en.messages.js";
import { KO_NOTIFICATION_GRAMMAR } from "./locales/ko.messages.js";
import {
  NOTIFICATION_COPY_CATALOG,
  type NotificationCopy,
  type NotificationCopyArgs,
  type NotificationCopyCatalog,
  type NotificationCopyFacts,
  type NotificationCopyText,
  type NotificationLocaleGrammar,
  type NotificationMessage,
  type NotificationVariantContext,
} from "./notification-copy-catalog.messages.js";
import { formatNotificationCopyText } from "./notification-copy-format.messages.js";

const KOREAN_NOTIFICATION_LABEL_MAX_GRAPHEMES = 24;
const ENGLISH_NOTIFICATION_LABEL_MAX_GRAPHEMES = 16;
const ELLIPSIS = "…";

const NOTIFICATION_GRAMMAR = {
  ko: KO_NOTIFICATION_GRAMMAR,
  en: EN_NOTIFICATION_GRAMMAR,
} satisfies Record<SupportedLocale, NotificationLocaleGrammar>;

interface NotificationLabelPreviewInput {
  readonly label: string;
  readonly locale: SupportedLocale;
}

/**
 * 잠금 화면에서 읽을 수 있는 동적 라벨 미리보기를 만든다.
 * 결합 문자와 emoji sequence를 쪼개지 않으며 말줄임표까지
 * 한국어 24 grapheme, 영어 16 grapheme으로 제한한다.
 */
export function createNotificationLabelPreview({
  label,
  locale,
}: NotificationLabelPreviewInput): string {
  const normalizedLabel = label.trim();
  const maxGraphemes =
    locale === "en"
      ? ENGLISH_NOTIFICATION_LABEL_MAX_GRAPHEMES
      : KOREAN_NOTIFICATION_LABEL_MAX_GRAPHEMES;
  const graphemes = Array.from(
    new Intl.Segmenter(locale, { granularity: "grapheme" }).segment(normalizedLabel),
    ({ segment }) => segment,
  );

  if (graphemes.length <= maxGraphemes) {
    return normalizedLabel;
  }

  return `${graphemes.slice(0, maxGraphemes - 1).join("")}${ELLIPSIS}`;
}

// 앱 계약(notificationContentSchema)과 같은 한도다. 넘으면 저장·발송하지 않는다
function toNotificationContent(copy: NotificationCopy): NotificationCopy | null {
  if (
    copy.title.length > NOTIFICATION_LIMITS.MAX_TITLE_LENGTH ||
    copy.body.length > NOTIFICATION_LIMITS.MAX_BODY_LENGTH
  ) {
    return null;
  }
  return { title: copy.title, body: copy.body };
}

/** 이름을 모를 때 쓰는 그 언어의 대체 이름(ko `친구`, en `A friend`). */
export function notificationFriendFallback(locale: SupportedLocale): string {
  return NOTIFICATION_COPY_CATALOG[locale].parts.name.unknownActor;
}

/** 호출자가 넘긴 대체 이름은 "이름 모름"으로 저장해 다른 언어에서 그 언어의 대체 이름으로 렌더링한다. */
export function toNameFact(name: string | null, locale: SupportedLocale): string | null {
  return name == null || name === notificationFriendFallback(locale) ? null : name;
}

/** 푸시를 만드는 순간에만 쓰는 표시 함수. 저장한 사실로 다시 렌더링할 때는 사실 값으로 직접 만든다. */
export interface NotificationCopyOverrides {
  readonly formatTime?: (instant: Date) => string;
}

export interface NotificationCopyContext {
  readonly locale: SupportedLocale;
  readonly parts: NotificationCopyCatalog["parts"];
  readonly overrides: NotificationCopyOverrides;
  text(message: NotificationCopyText, args?: NotificationCopyArgs): string;
  copy(
    variant: { readonly title: NotificationCopyText; readonly body: NotificationCopyText },
    args?: NotificationCopyArgs,
  ): NotificationCopy;
  preview(label: string): string;
  /** `{sender}`·`{senderSubject}`… 이름 자리 인자. null이면 그 언어의 대체 이름이다. */
  names(role: string, name: string | null): NotificationCopyArgs;
}

function createCopyContext(
  locale: SupportedLocale,
  overrides: NotificationCopyOverrides,
): NotificationCopyContext {
  const catalog = NOTIFICATION_COPY_CATALOG[locale];
  const text = (message: NotificationCopyText, args: NotificationCopyArgs = {}) =>
    formatNotificationCopyText(message, args, locale);
  return {
    locale,
    parts: catalog.parts,
    overrides,
    text,
    copy: (variant, args) => ({ title: text(variant.title, args), body: text(variant.body, args) }),
    preview: (label) => createNotificationLabelPreview({ label, locale }),
    names(role, name) {
      const forms = NOTIFICATION_GRAMMAR[locale].nameForms(
        name ?? catalog.parts.name.unknownActor,
        catalog.parts.name,
      );
      return Object.fromEntries(
        Object.entries(forms).map(([form, value]) => [
          form === "name" ? role : `${role}${capitalize(form)}`,
          value,
        ]),
      );
    },
  };
}

/** 저장한 copyKey로 다시 렌더링하는 쪽이 아는 템플릿 모양(사실 타입과 무관). */
export interface StoredNotificationCopyTemplate {
  /** `<그룹>.<템플릿>`. 카탈로그 경로와 같다 */
  readonly key: string;
  /** 기준 언어의 variant 이름(`default` 또는 `v1`…`vN`) 순서 */
  readonly variantNames: readonly string[];
  /** 저장한 사실을 검증해 렌더링한다. 없는 variant·맞지 않는 사실이면 null */
  renderStored(
    variantName: string,
    facts: unknown,
    locale: SupportedLocale,
  ): NotificationCopy | null;
}

export interface NotificationCopyTemplate<
  TFacts extends NotificationCopyFacts,
> extends StoredNotificationCopyTemplate {
  /** 사실로 문구를 다시 만들 수 없으면(예: 시간대를 모르는 옛 사실) null */
  render(
    variantName: string,
    facts: TFacts,
    locale: SupportedLocale,
    overrides?: NotificationCopyOverrides,
  ): NotificationCopy | null;
}

interface NotificationCopyDefinition<TFacts extends NotificationCopyFacts, TVariant> {
  readonly key: string;
  readonly variants: (catalog: NotificationCopyCatalog) => Readonly<Record<string, TVariant>>;
  readonly facts: z.ZodType<TFacts>;
  readonly render: (
    variant: TVariant,
    facts: TFacts,
    context: NotificationCopyContext,
  ) => NotificationCopy | null;
}

export function defineNotificationCopy<TFacts extends NotificationCopyFacts, TVariant>(
  definition: NotificationCopyDefinition<TFacts, TVariant>,
): NotificationCopyTemplate<TFacts> {
  const render: NotificationCopyTemplate<TFacts>["render"] = (
    variantName,
    facts,
    locale,
    overrides = {},
  ) => {
    const variants = definition.variants(NOTIFICATION_COPY_CATALOG[locale]);
    const variant = Object.hasOwn(variants, variantName) ? variants[variantName] : undefined;
    return variant == null
      ? null
      : definition.render(variant, facts, createCopyContext(locale, overrides));
  };
  return {
    key: definition.key,
    variantNames: Object.keys(definition.variants(NOTIFICATION_COPY_CATALOG.ko)),
    render,
    renderStored(variantName, facts, locale) {
      const parsedFacts = definition.facts.safeParse(facts);
      if (!parsedFacts.success) {
        return null;
      }
      const copy = render(variantName, parsedFacts.data, locale);
      return copy == null ? null : toNotificationContent(copy);
    },
  };
}

/** 기준 언어 variant 순서의 index번째 variant를 렌더링한다. 어느 variant를 고를지는 호출자가 정한다. */
export function renderNotificationVariant<TFacts extends NotificationCopyFacts>(
  template: NotificationCopyTemplate<TFacts>,
  index: number,
  facts: TFacts,
  locale: SupportedLocale,
  overrides?: NotificationCopyOverrides,
): Omit<NotificationMessage, "variantId"> {
  const variantName = template.variantNames[index] ?? template.variantNames[0] ?? "default";
  const copy = template.render(variantName, facts, locale, overrides);
  if (copy == null) {
    throw new Error(`Notification copy ${template.key}.${variantName} cannot render its facts`);
  }
  const content = toNotificationContent(copy);
  if (content == null) {
    throw new RangeError(
      `Notification copy ${template.key}.${variantName} exceeds the notification length limits`,
    );
  }
  return {
    ...content,
    copyKey: `${template.key}.${variantName}`,
    copyFacts: facts,
  };
}

interface RenderNotificationTemplateInput<TFacts> {
  readonly facts: TFacts;
  readonly locale: SupportedLocale;
  readonly variantContext?: NotificationVariantContext;
  readonly templateKey?: string;
  readonly overrides?: NotificationCopyOverrides;
}

/** 동일한 seed에서 동일한 카피와 분석용 variant ID를 반환한다. 선택은 언어와 무관하다. */
export function renderNotificationTemplate<TFacts extends NotificationCopyFacts>(
  template: NotificationCopyTemplate<TFacts>,
  {
    facts,
    locale,
    variantContext,
    templateKey,
    overrides,
  }: RenderNotificationTemplateInput<TFacts>,
): NotificationMessage {
  const variantNamespace = variantContext
    ? templateKey
      ? `${variantContext.campaignKey}.${templateKey}`
      : variantContext.campaignKey
    : undefined;

  if (template.variantNames[0] === "default") {
    return {
      ...renderNotificationVariant(template, 0, facts, locale, overrides),
      variantId: variantNamespace ? `${variantNamespace}.default` : "default",
    };
  }

  const index = variantContext
    ? deterministicIndex(
        `${variantNamespace}\u0000${variantContext.recipientId}\u0000${variantContext.occurrenceKey}`,
        template.variantNames.length,
      )
    : 0;
  return {
    ...renderNotificationVariant(template, index, facts, locale, overrides),
    variantId: variantNamespace ? `${variantNamespace}.v${index + 1}` : `v${index + 1}`,
  };
}
