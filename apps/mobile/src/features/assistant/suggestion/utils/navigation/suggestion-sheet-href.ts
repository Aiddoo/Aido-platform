export const SUGGESTION_SHEET_FALLBACK_HREF = { pathname: '/suggestions' } as const;

/** 제안을 받아들이면 할 일 피드로 간다. */
export const SUGGESTION_ACCEPTED_HREF = { pathname: '/feed' } as const;

export function suggestionCategorySheetHref({ suggestionId }: { suggestionId: number }) {
  return { pathname: '/suggestions/[suggestionId]/category', params: { suggestionId } } as const;
}
