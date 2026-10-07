import type { AuthEmailSenderPort } from "#api/modules/identity/application/ports/auth/auth-collaboration.port";
import type {
  EmailSendResult,
  EmailTag,
  EmailType,
  InquiryTemplateData,
} from "#api/modules/notification/notification-email.public";

interface SentEmail extends VerificationEmailData {
  type: EmailType;
  sentAt: Date;
  idempotencyKey?: string;
  tags?: EmailTag[];
}

interface SentInquiry {
  to: string;
  data: InquiryTemplateData;
  sentAt: Date;
}

type VerificationEmailData = Parameters<AuthEmailSenderPort["sendVerificationCode"]>[1];

export class FakeEmailService implements AuthEmailSenderPort {
  readonly #sentEmails = new Map<string, SentEmail>();
  #sentInquiries: SentInquiry[] = [];
  readonly #idempotencyKeys = new Set<string>();
  #failureCount = 0;
  #maximumFailures = 0;

  async sendVerificationCode(
    to: string,
    data: VerificationEmailData,
    idempotencyKey?: string,
  ): Promise<EmailSendResult> {
    return this.#recordCode(to, data, "verification", idempotencyKey);
  }

  async sendPasswordSetupCode(
    to: string,
    data: VerificationEmailData,
    idempotencyKey?: string,
  ): Promise<EmailSendResult> {
    return this.#recordCode(to, data, "password-setup", idempotencyKey);
  }

  async sendPasswordResetCode(
    to: string,
    data: VerificationEmailData,
    idempotencyKey?: string,
  ): Promise<EmailSendResult> {
    return this.#recordCode(to, data, "password-reset", idempotencyKey);
  }

  async sendInquiry(to: string, data: InquiryTemplateData): Promise<EmailSendResult> {
    const failure = this.#failureResult();
    if (failure !== null) return failure;
    this.#sentInquiries.push({ to, data, sentAt: new Date() });
    return { success: true, messageId: `fake-${Date.now()}`, retryCount: 0 };
  }

  #recordCode(
    to: string,
    data: VerificationEmailData,
    type: EmailType,
    idempotencyKey?: string,
  ): EmailSendResult {
    if (
      idempotencyKey !== undefined &&
      idempotencyKey.length > 0 &&
      this.#idempotencyKeys.has(idempotencyKey)
    ) {
      return { success: true, messageId: `fake-duplicate-${Date.now()}`, retryCount: 0 };
    }
    const failure = this.#failureResult();
    if (failure !== null) return failure;
    if (idempotencyKey !== undefined && idempotencyKey.length > 0)
      this.#idempotencyKeys.add(idempotencyKey);
    this.#sentEmails.set(to, {
      code: data.code,
      expiryMinutes: data.expiryMinutes,
      type,
      sentAt: new Date(),
      idempotencyKey,
      tags: [
        { name: "type", value: type },
        { name: "environment", value: "test" },
      ],
    });
    return { success: true, messageId: `fake-${Date.now()}`, retryCount: 0 };
  }

  getLastCode(email: string): string | undefined {
    return this.#sentEmails.get(email)?.code;
  }

  clear(): void {
    this.#sentEmails.clear();
    this.#sentInquiries = [];
    this.#idempotencyKeys.clear();
    this.resetFailureSimulation();
  }

  hasSentTo(email: string): boolean {
    return this.#sentEmails.has(email);
  }

  getSentEmail(email: string): SentEmail | undefined {
    return this.#sentEmails.get(email);
  }

  getIdempotencyKeys(): Set<string> {
    return new Set(this.#idempotencyKeys);
  }

  hasIdempotencyKey(key: string): boolean {
    return this.#idempotencyKeys.has(key);
  }

  getAllSentEmails(): Map<string, SentEmail> {
    return new Map(this.#sentEmails);
  }

  getSentCount(): number {
    return this.#sentEmails.size;
  }

  getLastInquiry(): SentInquiry | undefined {
    return this.#sentInquiries[this.#sentInquiries.length - 1];
  }

  getInquiryCount(): number {
    return this.#sentInquiries.length;
  }

  simulateFailures(count: number): void {
    this.#maximumFailures = count;
    this.#failureCount = 0;
  }

  resetFailureSimulation(): void {
    this.#maximumFailures = 0;
    this.#failureCount = 0;
  }

  getFailureCount(): number {
    return this.#failureCount;
  }

  #failureResult(): EmailSendResult | null {
    if (this.#failureCount >= this.#maximumFailures) return null;
    this.#failureCount += 1;
    return { success: false, error: "Simulated failure for testing", retryCount: 0 };
  }
}
