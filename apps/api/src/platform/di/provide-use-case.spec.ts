import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";

import { type LoggerToken, loggerFor, provideUseCase } from "./provide-use-case.js";

interface StampDependencies {
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: Pick<ClockPort, "now">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

class StampUseCase {
  readonly dependencies: StampDependencies;

  constructor(dependencies: StampDependencies) {
    this.dependencies = dependencies;
  }

  execute(): Promise<Temporal.Instant> {
    const { unitOfWork, clock } = this.dependencies;
    return unitOfWork.run(async () => clock.now());
  }
}

type StampTokens = Parameters<typeof provideUseCase<StampUseCase, StampDependencies>>[1];

describe("provideUseCase — 타입 검사되는 UseCase 조립", () => {
  it("의존성 키와 토큰 타입이 맞을 때만 받는다", () => {
    // Given
    type ValidTokens = {
      unitOfWork: typeof UnitOfWorkPort;
      clock: typeof ClockPort;
      logger: LoggerToken;
    };
    type MissingKey = { unitOfWork: typeof UnitOfWorkPort; clock: typeof ClockPort };
    type WrongClassToken = {
      unitOfWork: typeof ClockPort;
      clock: typeof ClockPort;
      logger: LoggerToken;
    };
    type LoggerInClockSlot = {
      unitOfWork: typeof UnitOfWorkPort;
      clock: LoggerToken;
      logger: LoggerToken;
    };

    // When & Then
    expectTypeOf<ValidTokens>().toExtend<StampTokens>();
    expectTypeOf<MissingKey>().not.toExtend<StampTokens>();
    expectTypeOf<WrongClassToken>().not.toExtend<StampTokens>();
    expectTypeOf<LoggerInClockSlot>().not.toExtend<StampTokens>();
  });

  it("abstract class 토큰과 logger를 이름대로 넣어 UseCase를 만든다", async () => {
    // Given
    const now = Temporal.Instant.from("2026-11-10T00:00:00Z");
    const unitOfWork = new ImmediateUnitOfWork();
    const module = await Test.createTestingModule({
      providers: [
        { provide: UnitOfWorkPort, useValue: unitOfWork },
        { provide: ClockPort, useValue: new FixedClock(now) },
        provideUseCase(StampUseCase, {
          unitOfWork: UnitOfWorkPort,
          clock: ClockPort,
          logger: loggerFor(StampUseCase),
        }),
      ],
    }).compile();

    // When
    const useCase = module.get(StampUseCase);
    const stamped = await useCase.execute();

    // Then
    expect(stamped.equals(now)).toBe(true);
    expect(unitOfWork.runCount).toBe(1);
    expect(useCase.dependencies.logger).toBeInstanceOf(Logger);
    expect(useCase.dependencies.logger).toMatchObject({ context: StampUseCase.name });
    await module.close();
  });
});
