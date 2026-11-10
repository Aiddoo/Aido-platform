import { Inject, Injectable } from "@nestjs/common";

import {
  RETENTION_ENROLLMENT,
  type RetentionEnrollmentPort,
} from "#api/modules/notification/notification-retention.public";

import type { RetentionEnrollerPort } from "../../application/ports/retention-enroller.port.js";

@Injectable()
export class RetentionEnrollerAdapter implements RetentionEnrollerPort {
  readonly #retentionEnrollment: RetentionEnrollmentPort;

  constructor(
    @Inject(RETENTION_ENROLLMENT)
    retentionEnrollment: RetentionEnrollmentPort,
  ) {
    this.#retentionEnrollment = retentionEnrollment;
  }

  enrollNewUser(userId: string, activated: boolean): Promise<void> {
    return this.#retentionEnrollment.enrollNewUser(userId, activated);
  }

  activateNewUser(userId: string): Promise<void> {
    return this.#retentionEnrollment.activateNewUser(userId);
  }
}
