import type { SupportedLocale } from "#api/shared/domain/locale";

/** 신규 가입 시 시딩되는 기본 카테고리 (auth·oauth 회원가입 트랜잭션에서 사용) */
export interface DefaultCategoryData {
  name: string;
  color: string;
  sortOrder: number;
}

/** 카테고리 삭제를 거절하는 이유. use case가 출시 앱이 아는 오류 코드로 바꾼다 */
export const CATEGORY_DELETION_REJECTIONS = [
  "last-category",
  "move-target-required",
  "same-target",
  "move-target-not-allowed",
] as const;

/** 이름은 사용자가 고치는 데이터라 가입할 때의 언어로 한 번만 정하고, 이후 언어를 바꿔도 다시 쓰지 않는다. */
export const DEFAULT_CATEGORIES: Readonly<Record<SupportedLocale, readonly DefaultCategoryData[]>> =
  {
    ko: [
      { name: "중요한 일", color: "#FFB3B3", sortOrder: 0 },
      { name: "할 일", color: "#FF6B43", sortOrder: 1 },
    ],
    en: [
      { name: "Important", color: "#FFB3B3", sortOrder: 0 },
      { name: "To-do", color: "#FF6B43", sortOrder: 1 },
    ],
  };
