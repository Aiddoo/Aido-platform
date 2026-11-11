export interface UnitOfWorkOptions {
  /** 앱 풀 세션 기본값보다 긴 배치가 이 트랜잭션에서만 쓴다. 클라이언트 query_timeout(20초)을 넘길 수 없다. 이미 열린 UoW에 합류하면 바깥 값을 따른다. */
  readonly statementTimeoutMs?: number;
}

/** Required propagation joins the active UoW; repositories read its connection through CLS. */
export abstract class UnitOfWorkPort {
  abstract run<T>(work: () => Promise<T>, options?: UnitOfWorkOptions): Promise<T>;
}
