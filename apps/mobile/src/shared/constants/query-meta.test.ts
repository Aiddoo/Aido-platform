import type { QueryMeta } from '@tanstack/react-query';

import './query-meta';

// 인덱스 시그니처가 있거나 interface로 선언하면 QueryMeta가 조용히 Record<string, unknown>으로 돌아가 오타가 통과한다
const metaIsClosed: [keyof QueryMeta] extends ['persist' | 'refreshOnPremiumChange']
  ? true
  : false = true;

describe('AppQueryMeta', () => {
  it('등록한 키만 쓸 수 있도록 닫혀 있다', () => {
    // Then
    expect(metaIsClosed).toBe(true);
  });
});
