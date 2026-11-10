export const MUTATION_LOCK = Symbol("MUTATION_LOCK");

/**
 * 업무 트랜잭션 범위 mutation lock 포트.
 *
 * 호출자는 UNIT_OF_WORK.run 콜백 안에서 필요한 논리 키를 전달한다.
 * 구현체는 같은 업무 트랜잭션 연결에서 키 전체를 결정적 순서로 획득하고,
 * 트랜잭션 종료 시 데이터베이스가 자동으로 해제하는 잠금만 사용한다.
 */
export abstract class MutationLockPort {
  abstract acquire(keys: readonly string[]): Promise<void>;
}

export const MUTATION_KEY_PREFIX = "mutation:v1";
