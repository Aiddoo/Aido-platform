import type {
	JobData,
	JobEnvelope,
} from "@/shared/application/ports/job-runtime.port";

export type NamedJob<TMap extends { [K in keyof TMap]: JobData }> = {
	[K in keyof TMap & string]: {
		readonly name: K;
		readonly data: Readonly<TMap[K]>;
	};
}[keyof TMap & string];

/**
 * 기존 BullMQ queue에 남아 있는 raw job을 새 discriminated message로 복원한다.
 * name/data 상관관계는 기존 producer가 보장하며 이 함수가 vendor 경계를 한 곳에 격리한다.
 */
export function fromLegacyJob<TMap extends { [K in keyof TMap]: JobData }>(
	job: JobEnvelope<JobData>,
): NamedJob<TMap> {
	return { name: job.name, data: job.data } as NamedJob<TMap>;
}
