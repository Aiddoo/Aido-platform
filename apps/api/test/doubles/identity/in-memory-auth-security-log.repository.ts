import {
  AuthSecurityLogRepositoryPort,
  type NewSecurityLog,
} from "#api/modules/identity/auth/application/ports/auth-security-log.repository.port";

export class InMemoryAuthSecurityLogRepository extends AuthSecurityLogRepositoryPort {
  readonly entries: NewSecurityLog[] = [];

  async create(entry: NewSecurityLog): Promise<void> {
    this.entries.push(entry);
  }
}
