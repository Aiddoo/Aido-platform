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
  readonly #importRenderer: () => Promise<EmailRenderer>;
  #renderer: Promise<EmailRenderer> | null = null;

  constructor(
    supportEmail: string,
    importRenderer: () => Promise<EmailRenderer> = () => import("./email-renderer.js"),
  ) {
    this.#supportEmail = supportEmail;
    this.#importRenderer = importRenderer;
  }

  async render({ template, locale }: LocalizedEmailTemplate): Promise<RenderedEmail> {
    const renderer = await this.#loadRenderer();
    return renderer.renderEmail(template, { locale, supportEmail: this.#supportEmail });
  }

  // React Email은 무거워 부팅 때 불러오지 않고 처음 렌더할 때 한 번만 불러온다
  #loadRenderer(): Promise<EmailRenderer> {
    // 실패한 불러오기를 남겨 두면 재시작 전까지 모든 코드 메일이 실패하므로 다음 렌더가 다시 불러오게 비운다
    this.#renderer ??= this.#importRenderer().catch((error: unknown) => {
      this.#renderer = null;
      throw error;
    });
    return this.#renderer;
  }
}
