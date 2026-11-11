import { queryOptions } from '@tanstack/react-query';

import type { AiSuggestion } from '../domains/suggestion.model';

// 'ai' 접두어는 리포트와 같은 서버 모듈(ai) 키 공간을 쓰던 옛 키라 그대로 둔다
export const SUGGESTION_QUERY_KEYS = {
  all: ['ai', 'suggestions'] as const,
  list: () => queryOptions<AiSuggestion[]>({ queryKey: [...SUGGESTION_QUERY_KEYS.all] }).queryKey,
} as const;
