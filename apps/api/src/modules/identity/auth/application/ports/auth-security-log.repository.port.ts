export abstract class AuthSecurityLogRepositoryPort {
  abstract create(data: {
    userId?: string;
    event: string;
    ipAddress: string;
    userAgent: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
}
