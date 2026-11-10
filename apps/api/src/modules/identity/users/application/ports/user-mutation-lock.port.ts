/** 옛 토큰. 아직 옮기지 않은 소비 Context가 쓴다(같은 인스턴스 별칭으로 바인딩) */
export const USER_MUTATION_LOCK = Symbol("USER_MUTATION_LOCK");

export abstract class UserMutationLockPort {
  abstract lockById(userId: string): Promise<boolean>;
}
