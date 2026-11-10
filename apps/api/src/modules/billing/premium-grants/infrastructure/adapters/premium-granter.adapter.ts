import { Injectable } from "@nestjs/common";

import {
  type GrantPremiumInput,
  type GrantPremiumResult,
  PremiumGranterPort,
} from "../../application/ports/premium-granter.port.js";
import { GrantPremiumUseCase } from "../../application/use-cases/grant-premium.use-case.js";

// 다른 Context에 여는 문. 입력은 UseCase 명령과 같아 그대로 넘긴다
@Injectable()
export class PremiumGranterAdapter extends PremiumGranterPort {
  readonly #grantPremium: Pick<GrantPremiumUseCase, "execute">;

  constructor(grantPremium: GrantPremiumUseCase) {
    super();
    this.#grantPremium = grantPremium;
  }

  grant(input: GrantPremiumInput): Promise<GrantPremiumResult> {
    return this.#grantPremium.execute(input);
  }
}
