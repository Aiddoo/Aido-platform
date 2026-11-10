import { Injectable } from "@nestjs/common";

import {
  ResourceBonusGranterPort,
  type GrantResourceBonusInput,
  type GrantResourceBonusResult,
} from "../../application/ports/resource-bonus-granter.port.js";
import { GrantResourceBonusUseCase } from "../../application/use-cases/grant-resource-bonus.use-case.js";

// 다른 Context에 여는 문. 입력은 UseCase 명령과 같아 그대로 넘긴다
@Injectable()
export class ResourceBonusGranterAdapter extends ResourceBonusGranterPort {
  readonly #grantResourceBonus: Pick<GrantResourceBonusUseCase, "execute">;

  constructor(grantResourceBonus: GrantResourceBonusUseCase) {
    super();
    this.#grantResourceBonus = grantResourceBonus;
  }

  grant(input: GrantResourceBonusInput): Promise<GrantResourceBonusResult> {
    return this.#grantResourceBonus.execute(input);
  }
}
