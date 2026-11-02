export interface AppQueryMeta extends Record<string, unknown> {
  /** 기기에 저장해 오프라인으로 앱을 다시 열어도 마지막 데이터를 보여 준다 */
  persist?: boolean;
  /** 프리미엄 여부에 따라 서버가 한도·사용량·접근을 다르게 주는 조회. 프리미엄이 바뀌면 다시 불러온다 */
  refreshOnPremiumChange?: boolean;
}

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: AppQueryMeta;
  }
}
