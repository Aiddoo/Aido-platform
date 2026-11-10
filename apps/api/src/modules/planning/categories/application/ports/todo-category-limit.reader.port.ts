// access가 계산한 featureQuota를 한도 오류 details에 그대로 싣는다. 카테고리는 값을 해석하지 않는다
export type TodoCategoryFeatureQuota = Readonly<Record<string, unknown>>;

/** 카테고리 보유 한도. null은 무제한이다. 생성은 원자성 때문에 활성 트랜잭션 연결에서 캐시 없이 읽는다. */
export abstract class TodoCategoryLimitReaderPort {
  /** 화면 표시용이라 캐시를 거쳐도 된다. */
  abstract readLimit(userId: string): Promise<number | null>;
  abstract readLimitInTx(userId: string): Promise<number | null>;
  /** 한도 오류 details에 싣는 서버 계산 featureQuota. count는 같은 잠금 안에서 센 현재 개수다. */
  abstract readFeatureQuotaInTx(userId: string, count: number): Promise<TodoCategoryFeatureQuota>;
}
