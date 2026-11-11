import type { SupportedLocale } from "#api/shared/domain/locale";

import enNotification from "../../../../../i18n/en/notification.json" with { type: "json" };
import koNotification from "../../../../../i18n/ko/notification.json" with { type: "json" };

/** 기준 언어 ko 카탈로그(`src/i18n/ko/notification.json`) 모양. */
export type NotificationCopyCatalog = typeof koNotification;

/** `@nestjs/i18n`이 읽는 카탈로그와 같은 JSON. 어느 언어든 ko의 키가 빠지면 컴파일 오류다. */
export const NOTIFICATION_COPY_CATALOG = {
  ko: koNotification,
  en: enNotification,
} satisfies Record<SupportedLocale, NotificationCopyCatalog>;

/** 카탈로그 문구 하나. 복수형은 `count` 인자로 CLDR 범주를 고른다. */
export type NotificationCopyText = string | { readonly other: string };

export type NotificationCopyArgs = Readonly<Record<string, string | number>>;

/** 로케일 카탈로그가 렌더링하는 제목과 본문. */
export interface NotificationCopy {
  readonly title: string;
  readonly body: string;
}

/** 다른 언어로 다시 렌더링할 원본 사실. 언어로 다듬은 값(조사·말줄임·날짜 문자열)은 넣지 않는다. */
type NotificationCopyFactValue = string | number | boolean | null;
export type NotificationCopyFacts = Readonly<Record<string, NotificationCopyFactValue>>;

/** 이름 자리 표기. ko는 조사, en은 문장 첫 주어(`A friend`)·문장 중간(`your friend`)이 달라진다. */
const NOTIFICATION_NAME_FORMS = [
  "name",
  "subject",
  "actor",
  "with",
  "topic",
  "author",
  "partner",
] as const;
export type NotificationNameForm = (typeof NOTIFICATION_NAME_FORMS)[number];

export interface NotificationLocaleGrammar {
  /** 이름 하나를 자리별 표기로 만든다. 이름을 모르면 `name`은 그 언어의 대체 이름이다. */
  readonly nameForms: (
    name: string,
    names: NotificationCopyCatalog["parts"]["name"],
  ) => Readonly<Record<NotificationNameForm, string>>;
}

export type RetentionNotificationCopySelection =
  | { readonly stage: "D0"; readonly copyKey: "d0_no_todo" }
  | {
      readonly stage: "D1";
      readonly copyKey: "d1_no_todo" | "d1_has_todo_no_completion";
    }
  | { readonly stage: "D3"; readonly copyKey: "d3_restart" }
  | { readonly stage: "D7"; readonly copyKey: "d7_has_progress" | "d7_restart" };

export type RetentionTemplateKey = keyof NotificationCopyCatalog["retention"];

/** 재시도에도 같은 카피를 선택하기 위한 결정적 variant seed. */
export interface NotificationVariantContext {
  readonly campaignKey: string;
  readonly recipientId: string;
  /** 사용자 로컬 날짜(YYYY-MM-DD) 또는 불변 이벤트 ID */
  readonly occurrenceKey: string;
}

/** 저장해 두었다가 다른 언어로 다시 렌더링할 문구 식별자와 원본 사실. */
interface NotificationCopyReference {
  /** `<그룹>.<템플릿>.<variant>`(예: `scheduler.MORNING_REMINDER.v2`). 언어와 무관하다 */
  readonly copyKey: string;
  readonly copyFacts: NotificationCopyFacts;
}

/** 분석 가능한 variant 식별자를 포함한 최종 푸시 문구. */
export interface NotificationMessage extends NotificationCopy, NotificationCopyReference {
  readonly variantId: string;
}
