import type { QueryMeta } from '@tanstack/react-query';

// 반드시 type이다. QueryMeta는 `TQueryMeta extends Record<string, unknown>`일 때만 등록한 타입을 쓰는데
// 인덱스 시그니처 없는 interface는 이 조건을 통과하지 못해 Record로 돌아간다(아래 AppQueryMetaGuard가 잡는다)
export type AppQueryMeta = {
  /** 기기에 저장해 오프라인으로 앱을 다시 열어도 마지막 데이터를 보여 준다 */
  persist?: boolean;
  /** 프리미엄 여부에 따라 서버가 한도·사용량·접근을 다르게 주는 조회. 프리미엄이 바뀌면 다시 불러온다 */
  refreshOnPremiumChange?: boolean;
  /** 할 일이 바뀌면 보이는 값이 달라지는 조회(콕 상태 등). 할 일을 바꾼 뒤 다시 불러온다 */
  refreshOnTodoChange?: boolean;
  /** 차단·해제에 따라 서버가 가리는 사람이 달라지는 조회(친구, 댓글, 콕). 차단을 바꾼 뒤 다시 불러온다 */
  refreshOnBlockChange?: boolean;
};

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: AppQueryMeta;
  }
}

type AssertClosedQueryMeta<Key extends keyof AppQueryMeta> = Key;
/** QueryMeta가 조용히 Record<string, unknown>으로 돌아가 오타가 통과하게 되면 여기서 컴파일 오류가 난다 */
export type AppQueryMetaGuard = AssertClosedQueryMeta<keyof QueryMeta>;
