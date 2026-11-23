import { UserTagGeneratorPort } from "#api/modules/identity/users/application/ports/user-tag-generator.port";

export class StubUserTagGenerator extends UserTagGeneratorPort {
  readonly #userTag: string;

  constructor(userTag: string) {
    super();
    this.#userTag = userTag;
  }

  generate(): string {
    return this.#userTag;
  }
}
