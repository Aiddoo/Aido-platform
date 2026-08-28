import { AsyncLocalStorage } from "node:async_hooks";

import { Logger } from "@nestjs/common";
import { ClsService } from "nestjs-cls";

import type { AfterCommitTaskRegistryPort } from "@/shared/application/ports";

import { ClsUnitOfWork } from "./cls-unit-of-work";

const TRANSACTION_ACTIVE = Symbol("TEST_TRANSACTION_ACTIVE");

class FakeTransactionHost {
	commitError: Error | undefined;

	constructor(private readonly cls: ClsService) {}

	isTransactionActive(): boolean {
		return this.cls.get<boolean>(TRANSACTION_ACTIVE) ?? false;
	}

	withTransaction<T>(work: () => Promise<T>): Promise<T> {
		if (this.isTransactionActive()) {
			return this.cls.run({ ifNested: "inherit" }, work);
		}

		return this.cls.run({ ifNested: "inherit" }, async () => {
			this.cls.set(TRANSACTION_ACTIVE, true);
			const result = await work();
			if (this.commitError) {
				throw this.commitError;
			}
			return result;
		});
	}
}

interface Deferred {
	readonly promise: Promise<void>;
	readonly resolve: () => void;
}

function createDeferred(): Deferred {
	let release: () => void = () => undefined;
	const promise = new Promise<void>((resolve) => {
		release = resolve;
	});
	return { promise, resolve: release };
}

describe("ClsUnitOfWork — after-commit task registry", () => {
	let txHost: FakeTransactionHost;
	let unitOfWork: ClsUnitOfWork;
	let registry: AfterCommitTaskRegistryPort;

	beforeEach(() => {
		const cls = new ClsService(new AsyncLocalStorage());
		txHost = new FakeTransactionHost(cls);
		unitOfWork = new ClsUnitOfWork(txHost, cls);
		registry = unitOfWork;
		jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
	});

	it("root transaction이 commit된 뒤에만 등록 작업을 실행한다", async () => {
		const events: string[] = [];

		const result = await unitOfWork.run(async () => {
			registry.register(async () => {
				events.push("after-commit");
			});
			expect(events).toEqual([]);
			return "business-result";
		});

		expect(result).toBe("business-result");
		expect(events).toEqual(["after-commit"]);
	});

	it("work가 rollback되면 등록 작업을 실행하지 않는다", async () => {
		const task = jest.fn().mockResolvedValue(undefined);

		await expect(
			unitOfWork.run(async () => {
				registry.register(task);
				throw new Error("rollback");
			}),
		).rejects.toThrow("rollback");

		expect(task).not.toHaveBeenCalled();
	});

	it("commit 자체가 실패해도 등록 작업을 실행하지 않는다", async () => {
		const task = jest.fn().mockResolvedValue(undefined);
		txHost.commitError = new Error("commit failed");

		await expect(
			unitOfWork.run(async () => {
				registry.register(task);
				return "uncommitted";
			}),
		).rejects.toThrow("commit failed");

		expect(task).not.toHaveBeenCalled();
	});

	it("nested Required UoW가 같은 배열에 등록하고 root commit 뒤 FIFO로 실행한다", async () => {
		const events: string[] = [];
		const task = (name: string) => async () => {
			events.push(name);
		};

		await unitOfWork.run(async () => {
			registry.register(task("outer-before"));
			await unitOfWork.run(async () => {
				registry.register(task("nested"));
				expect(events).toEqual([]);
			});
			registry.register(task("outer-after"));
			expect(events).toEqual([]);
		});

		expect(events).toEqual(["outer-before", "nested", "outer-after"]);
	});

	it("한 작업의 실패가 다음 작업과 이미 commit된 business result를 막지 않는다", async () => {
		const secondTask = jest.fn().mockResolvedValue(undefined);

		await expect(
			unitOfWork.run(async () => {
				registry.register(jest.fn().mockRejectedValue(new Error("side effect failed")));
				registry.register(secondTask);
				return "committed";
			}),
		).resolves.toBe("committed");

		expect(secondTask).toHaveBeenCalledTimes(1);
		expect(Logger.prototype.error).toHaveBeenCalledWith("After-commit task failed (Error)");
	});

	it("동시에 실행되는 root transaction의 task scope를 서로 격리한다", async () => {
		const firstReady = createDeferred();
		const releaseFirst = createDeferred();
		const events: string[] = [];

		const firstRun = unitOfWork.run(async () => {
			registry.register(async () => {
				events.push("first");
			});
			firstReady.resolve();
			await releaseFirst.promise;
		});
		await firstReady.promise;

		await unitOfWork.run(async () => {
			registry.register(async () => {
				events.push("second");
			});
		});
		expect(events).toEqual(["second"]);

		releaseFirst.resolve();
		await firstRun;
		expect(events).toEqual(["second", "first"]);
	});

	it("transaction 밖에서는 즉시 실행하고 rejection을 관측한다", async () => {
		const task = jest.fn().mockRejectedValue(new Error("immediate failure"));

		registry.register(task);
		expect(task).toHaveBeenCalledTimes(1);
		await Promise.resolve();

		expect(Logger.prototype.error).toHaveBeenCalledWith("After-commit task failed (Error)");
	});

	it("transaction 밖 task의 synchronous throw도 caller에 전파하지 않는다", () => {
		const task = jest.fn().mockImplementation(() => {
			throw new Error("synchronous failure");
		});

		expect(() => registry.register(task)).not.toThrow();
		expect(Logger.prototype.error).toHaveBeenCalledWith("After-commit task failed (Error)");
	});

	it("active transaction에 registry scope가 없으면 invariant 오류를 낸다", async () => {
		await txHost.withTransaction(async () => {
			expect(() => registry.register(jest.fn().mockResolvedValue(undefined))).toThrow(
				"After-commit task scope is missing for an active transaction",
			);
		});
	});
});
