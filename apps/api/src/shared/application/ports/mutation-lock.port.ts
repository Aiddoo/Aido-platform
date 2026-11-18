/**
 * 업무 트랜잭션 범위 mutation lock 포트.
 *
 * 호출자는 UnitOfWorkPort.run 콜백 안에서 필요한 논리 키를 전달한다.
 * 구현체는 같은 업무 트랜잭션 연결에서 키 전체를 결정적 순서로 획득하고,
 * 트랜잭션 종료 시 데이터베이스가 자동으로 해제하는 잠금만 사용한다.
 */
export abstract class MutationLockPort {
  abstract acquire(keys: readonly string[]): Promise<void>;
  // 기다리지 않는다. false면 일부 키가 잡혔을 수 있어 호출자는 경합 오류를 던져 트랜잭션을 끝낸다
  abstract tryAcquire(keys: readonly string[]): Promise<boolean>;
}

export const MUTATION_KEY_PREFIX = "mutation:v1";
