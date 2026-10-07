export const SUBSCRIPTION_USER_MUTATION_LOCK = Symbol("SUBSCRIPTION_USER_MUTATION_LOCK");

export interface SubscriptionUserMutationLockPort {
  lockById(userId: string): Promise<boolean>;
}
