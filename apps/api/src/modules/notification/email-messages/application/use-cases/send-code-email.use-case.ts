import type { SupportedLocale } from "@aido/api/vocabulary";

import type { CodeEmailKind } from "../../domain/email-delivery.constants.js";
import { toEmailMessage } from "../email-message.mapper.js";
import type {
  EmailTemplateRendererPort,
  VerificationCodeTemplateData,
} from "../ports/email-template-renderer.port.js";
import type { EmailDispatch, QueueEmailMessageUseCase } from "./queue-email-message.use-case.js";

export interface SendCodeEmailCommand {
  readonly to: string;
  readonly kind: CodeEmailKind;
  readonly templateData: VerificationCodeTemplateData;
  readonly locale: SupportedLocale;
}

interface SendCodeEmailDependencies {
  readonly renderer: Pick<EmailTemplateRendererPort, "render">;
  readonly queueEmailMessage: Pick<QueueEmailMessageUseCase, "execute">;
}

// 인증·비밀번호 재설정·비밀번호 설정 코드 메일을 받는 사람 언어로 렌더해 큐에 담는다
export class SendCodeEmailUseCase {
  readonly #dependencies: SendCodeEmailDependencies;

  constructor(dependencies: SendCodeEmailDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SendCodeEmailCommand): Promise<EmailDispatch> {
    const template = { kind: command.kind, data: command.templateData };
    const body = await this.#dependencies.renderer.render(template, command.locale);
    return this.#dependencies.queueEmailMessage.execute(toEmailMessage(command.to, template, body));
  }
}
