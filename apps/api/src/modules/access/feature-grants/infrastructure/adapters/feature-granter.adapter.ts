import { Injectable } from "@nestjs/common";

import {
  FeatureGranterPort,
  type FeatureGrantInput,
  type FeatureGrantResult,
} from "../../application/ports/feature-granter.port.js";
import { GrantFeatureUseCase } from "../../application/use-cases/grant-feature.use-case.js";

// 다른 Context에 여는 문. 입력은 UseCase 명령과 같아 그대로 넘긴다
@Injectable()
export class FeatureGranterAdapter implements FeatureGranterPort {
  readonly #grantFeature: Pick<GrantFeatureUseCase, "execute">;

  constructor(grantFeature: GrantFeatureUseCase) {
    this.#grantFeature = grantFeature;
  }

  grant(input: FeatureGrantInput): Promise<FeatureGrantResult> {
    return this.#grantFeature.execute(input);
  }
}
