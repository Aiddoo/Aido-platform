import { OPERATOR_EMAIL_LOCALE } from "../../domain/email-delivery.constants.js";
import { toEmailMessage } from "../email-message.mapper.js";
import type {
  EmailTemplateRendererPort,
  UserReportTemplateData,
} from "../ports/email-template-renderer.port.js";
import type { EmailDispatch, QueueEmailMessageUseCase } from "./queue-email-message.use-case.js";

export interface SendUserReportEmailCommand {
  readonly to: string;
  readonly templateData: UserReportTemplateData;
}

interface SendUserReportEmailDependencies {
  readonly renderer: Pick<EmailTemplateRendererPort, "render">;
  readonly queueEmailMessage: Pick<QueueEmailMessageUseCase, "execute">;
}

// 신고 접수를 운영자에게 알린다. 신고 id가 발송 건 id라 같은 신고는 큐에 한 번만 담긴다
export class SendUserReportEmailUseCase {
  readonly #dependencies: SendUserReportEmailDependencies;

  constructor(dependencies: SendUserReportEmailDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SendUserReportEmailCommand): Promise<EmailDispatch> {
    const template = { kind: "user-report", data: command.templateData } as const;
    const body = await this.#dependencies.renderer.render(template, OPERATOR_EMAIL_LOCALE);
    return this.#dependencies.queueEmailMessage.execute(toEmailMessage(command.to, template, body));
  }
}
