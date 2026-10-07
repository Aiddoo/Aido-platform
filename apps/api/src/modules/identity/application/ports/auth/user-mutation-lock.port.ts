export const USER_MUTATION_LOCK = Symbol("USER_MUTATION_LOCK");

export interface UserMutationLockPort {
  lockById(userId: string): Promise<boolean>;
}
