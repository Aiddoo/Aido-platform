import { describeCompletionGroupReaderContract } from "#test/contracts/insights/completion-group-reader.contract";
import { InMemoryCompletionGroupReader } from "#test/doubles/insights/in-memory-completion-group.reader";

// 같은 계약을 integration에서는 planning 조회 포트로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeCompletionGroupReaderContract(async (todos) => new InMemoryCompletionGroupReader(todos));
