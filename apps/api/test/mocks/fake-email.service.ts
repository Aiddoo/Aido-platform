import type { SupportedLocale } from "@aido/api/vocabulary";

import type { AuthEmailSenderPort } from "#api/modules/identity/auth/application/ports/auth-collaboration.port";
import type { EmailKind } from "#api/modules/notification/email-messages/domain/email-delivery.constants";
import type {
  EmailDispatch,
  EmailSendResult,
  InquiryTemplateData,
  UserReportTemplateData,
} from "#api/modules/notification/email-messages/notification-email-messages.public";

interface SentEmail extends VerificationEmailData {
  type: EmailKind;
  locale: SupportedLocale;
  sentAt: Date;
}

interface SentInquiry {
  to: string;
  data: InquiryTemplateData;
  sentAt: Date;
}

interface SentUserReport {
  to: string;
  data: UserReportTemplateData;
  sentAt: Date;
}

type VerificationEmailData = Parameters<AuthEmailSenderPort["sendVerificationCode"]>[1];

export class FakeEmailService implements AuthEmailSenderPort {
  readonly #sentEmails = new Map<string, SentEmail>();
  #sentInquiries: SentInquiry[] = [];
  #sentUserReports: SentUserReport[] = [];
  #failureCount = 0;
  #maximumFailures = 0;

  async sendVerificationCode(
    to: string,
    data: VerificationEmailData,
    locale: SupportedLocale,
  ): Promise<EmailDispatch> {
    return this.#recordCode(to, { ...data, type: "verification", locale });
  }

  async sendPasswordSetupCode(
    to: string,
    data: VerificationEmailData,
    locale: SupportedLocale,
  ): Promise<EmailDispatch> {
    return this.#recordCode(to, { ...data, type: "password-setup", locale });
  }

  async sendPasswordResetCode(
    to: string,
    data: VerificationEmailData,
    locale: SupportedLocale,
  ): Promise<EmailDispatch> {
    return this.#recordCode(to, { ...data, type: "password-reset", locale });
  }

  async sendInquiry(to: string, data: InquiryTemplateData): Promise<EmailSendResult> {
    if (this.#failureResult() !== null) {
      return { status: "rejected", reason: "delivery_failed" };
    }
    this.#sentInquiries.push({ to, data, sentAt: new Date() });
    return { status: "sent" };
  }

  async sendUserReport(to: string, data: UserReportTemplateData): Promise<EmailDispatch> {
    const failure = this.#failureResult();
    if (failure !== null) {
      return failure;
    }
    this.#sentUserReports.push({ to, data, sentAt: new Date() });
    return { status: "queued" };
  }

  #recordCode(to: string, email: Omit<SentEmail, "sentAt">): EmailDispatch {
    const failure = this.#failureResult();
    if (failure !== null) {
      return failure;
    }
    this.#sentEmails.set(to, { ...email, sentAt: new Date() });
    return { status: "queued" };
  }

  getLastCode(email: string): string | undefined {
    return this.#sentEmails.get(email)?.code;
  }

  clear(): void {
    this.#sentEmails.clear();
    this.#sentInquiries = [];
    this.#sentUserReports = [];
    this.resetFailureSimulation();
  }

  hasSentTo(email: string): boolean {
    return this.#sentEmails.has(email);
  }

  getSentEmail(email: string): SentEmail | undefined {
    return this.#sentEmails.get(email);
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

  getSentUserReports(): readonly SentUserReport[] {
    return [...this.#sentUserReports];
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

  #failureResult(): EmailDispatch | null {
    if (this.#failureCount >= this.#maximumFailures) {
      return null;
    }
    this.#failureCount += 1;
    return { status: "rejected", reason: "queue_unavailable" };
  }
}
