import { ValueObject } from "#api/shared/domain/model/value-object";

import { broadcastContentEmpty } from "./broadcasts.errors.js";

export interface BroadcastCopy {
  readonly title: string;
  readonly body: string;
}

export class BroadcastContent extends ValueObject<BroadcastCopy> {
  static create(input: BroadcastCopy): BroadcastContent {
    const title = input.title.trim();
    const body = input.body.trim();
    if (title.length === 0 || body.length === 0) {
      throw broadcastContentEmpty();
    }
    return new BroadcastContent({ title, body });
  }

  static reconstitute(input: BroadcastCopy): BroadcastContent {
    return new BroadcastContent({ title: input.title, body: input.body });
  }

  get title(): string {
    return this.value.title;
  }

  get body(): string {
    return this.value.body;
  }
}
