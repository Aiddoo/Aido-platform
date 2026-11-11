import type { InviteCode } from "../../domain/invite-code.vo.js";

export abstract class InviteCodeGeneratorPort {
  /** 추측할 수 없는 새 코드. 겹칠 수 있어 저장할 때 다시 확인한다. */
  abstract generate(): InviteCode;
}
