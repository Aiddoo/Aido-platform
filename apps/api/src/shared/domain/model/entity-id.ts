import { ValueObject } from "./value-object.js";

export abstract class EntityId<TValue extends string | number> extends ValueObject<TValue> {
  override toString(): string {
    return String(this.value);
  }
}
