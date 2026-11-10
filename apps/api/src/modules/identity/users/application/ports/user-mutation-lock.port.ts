export abstract class UserMutationLockPort {
  abstract lockById(userId: string): Promise<boolean>;
}
