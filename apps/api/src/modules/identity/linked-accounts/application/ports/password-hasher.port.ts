export abstract class PasswordHasherPort {
  abstract hash(password: string): Promise<string>;
  abstract verify(hash: string, password: string): Promise<boolean>;
  abstract needsRehash(hash: string): boolean;
}
