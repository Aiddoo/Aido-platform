import type { SupportedLocale } from "@aido/api/vocabulary";

import {
  type EmailTemplate,
  EmailTemplateRendererPort,
  type RenderedEmail,
} from "#api/modules/notification/email/application/ports/email-template-renderer.port";

// 템플릿 파일 없이 종류와 데이터가 그대로 보이는 본문을 만들고 받은 렌더 요청을 남긴다
export class StubEmailTemplateRenderer extends EmailTemplateRendererPort {
  readonly requests: { readonly template: EmailTemplate; readonly locale: SupportedLocale }[] = [];

  async render(template: EmailTemplate, locale: SupportedLocale): Promise<RenderedEmail> {
    this.requests.push({ template, locale });
    const data = JSON.stringify(template.data);
    return { subject: `[${template.kind}]`, html: `<p>${data}</p>`, text: data };
  }
}
