import { Inject, Injectable } from "@nestjs/common";

import { RetentionEnrollmentPort } from "#api/modules/notification/notification-retention.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { RetentionEnrollerPort } from "../../application/ports/retention-enroller.port.js";

@Injectable()
export class RetentionEnrollerAdapter implements RetentionEnrollerPort {
  readonly #retentionEnrollment: RetentionEnrollmentPort;

  constructor(
    @Inject(RetentionEnrollmentPort)
    retentionEnrollment: RetentionEnrollmentPort,
  ) {
    this.#retentionEnrollment = retentionEnrollment;
  }

  enrollNewUser(userId: UserId, activated: boolean): Promise<void> {
    return this.#retentionEnrollment.enrollNewUser(userId.value, activated);
  }

  activateNewUser(userId: UserId): Promise<void> {
    return this.#retentionEnrollment.activateNewUser(userId.value);
  }
}
