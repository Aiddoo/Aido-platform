import type { SupportedLocale } from "@aido/api/vocabulary";
import type { Mailable } from "@nestjs/mail";

import type {
  EmailTemplate,
  RenderedEmail,
} from "../../application/ports/email-template-renderer.port.js";

interface LocalizedEmailTemplate {
  readonly template: EmailTemplate;
  readonly locale: SupportedLocale;
}

interface EmailRenderer {
  renderEmail(
    template: EmailTemplate,
    options: { readonly locale: SupportedLocale; readonly supportEmail: string },
  ): Promise<RenderedEmail>;
}

/** `@nestjs/mail` 메일 클래스. 템플릿 하나를 받는 사람 언어의 제목·HTML·텍스트로 렌더한다. */
export class EmailTemplateMail implements Mailable<LocalizedEmailTemplate> {
  readonly #supportEmail: string;
  #renderer: Promise<EmailRenderer> | null = null;

  constructor(supportEmail: string) {
    this.#supportEmail = supportEmail;
  }

  async render({ template, locale }: LocalizedEmailTemplate): Promise<RenderedEmail> {
    const renderer = await this.#loadRenderer();
    return renderer.renderEmail(template, { locale, supportEmail: this.#supportEmail });
  }

  // React Email은 무거워 부팅 때 불러오지 않고 처음 렌더할 때 한 번만 불러온다
  #loadRenderer(): Promise<EmailRenderer> {
    this.#renderer ??= import("./email-renderer.js");
    return this.#renderer;
  }
}
