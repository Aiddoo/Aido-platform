import { Injectable } from "@nestjs/common";

import {
  FeatureGranterPort,
  type FeatureGrantInput,
  type FeatureGrantResult,
} from "../../application/ports/feature-granter.port.js";
import { GrantFeatureUseCase } from "../../application/use-cases/grant-feature.use-case.js";

// 다른 Context에 여는 문. 입력은 UseCase 명령과 같아 그대로 넘긴다
@Injectable()
export class FeatureGranterAdapter extends FeatureGranterPort {
  readonly #grantFeature: Pick<GrantFeatureUseCase, "execute">;

  constructor(grantFeature: GrantFeatureUseCase) {
    super();
    this.#grantFeature = grantFeature;
  }

  grant(input: FeatureGrantInput): Promise<FeatureGrantResult> {
    return this.#grantFeature.execute(input);
  }
}
