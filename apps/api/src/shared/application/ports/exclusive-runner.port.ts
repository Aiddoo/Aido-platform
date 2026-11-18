export type ExclusiveRunResult<T> =
  | { readonly status: "ran"; readonly value: T }
  | { readonly status: "held" };

/**
 * 여러 인스턴스(배포가 겹치는 블루·그린 포함) 중 하나만 돌아야 하는 작업을 감싼다.
 * 다른 곳이 같은 키로 돌고 있으면 기다리지 않고 "held"다. work는 잠금 트랜잭션 밖에서 돌아 자기 UoW를 따로 연다.
 * 잠금은 work가 끝나거나 연결이 끊기면 풀린다.
 */
export abstract class ExclusiveRunnerPort {
  abstract run<T>(key: string, work: () => Promise<T>): Promise<ExclusiveRunResult<T>>;
}
