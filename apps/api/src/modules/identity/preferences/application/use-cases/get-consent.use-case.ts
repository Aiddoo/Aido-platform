import { type UserConsentRepositoryPort } from "../ports/user-consent.repository.port.js";
import { buildConsentView, type ConsentView } from "../read-models/consent.read-model.js";

export interface GetConsentQuery {
  readonly userId: string;
}
interface GetConsentDependencies {
  readonly consentRepository: Pick<UserConsentRepositoryPort, "findByUserId">;
}

export class GetConsentUseCase {
  readonly #dependencies: GetConsentDependencies;

  constructor(dependencies: GetConsentDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetConsentQuery): Promise<ConsentView> {
    const consent = await this.#dependencies.consentRepository.findByUserId(input.userId);
    return buildConsentView(consent);
  }
}
