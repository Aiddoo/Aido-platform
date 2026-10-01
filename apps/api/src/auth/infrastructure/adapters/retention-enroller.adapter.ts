import { Inject, Injectable } from "@nestjs/common";

import { RETENTION_ENROLLMENT, type RetentionEnrollmentPort } from "#api/retention/index";

import type { RetentionEnrollerPort } from "../../application/ports/retention-enroller.port.js";

@Injectable()
export class RetentionEnrollerAdapter implements RetentionEnrollerPort {
	constructor(
		@Inject(RETENTION_ENROLLMENT)
		private readonly retentionEnrollment: RetentionEnrollmentPort,
	) {}

	enrollNewUser(userId: string, activated: boolean): Promise<void> {
		return this.retentionEnrollment.enrollNewUser(userId, activated);
	}

	activateNewUser(userId: string): Promise<void> {
		return this.retentionEnrollment.activateNewUser(userId);
	}
}
