import { scalarResolver } from "./scalar/scalar.ts";
import { queryTasksResolver } from "./task/query-tasks/query-tasks.resolver.ts";
import { queryTaskResolver } from "./task/query-task/query-task.resolver.ts";
import { queryTaskStagesResolver } from "./task/query-task-stages/query-task-stages.resolver.ts";
import { queryTaskJournalResolver } from "./task/query-task-journal/query-task-journal.resolver.ts";
import { queryTaskBranchesResolver } from "./task/query-task-branches/query-task-branches.resolver.ts";
import { mutationTaskCreateResolver } from "./task/mutation-task-create/mutation-task-create.resolver.ts";
import { mutationTaskSwitchResolver } from "./task/mutation-task-switch/mutation-task-switch.resolver.ts";
import { mutationTaskStartResolver } from "./task/mutation-task-start/mutation-task-start.resolver.ts";
import { mutationTaskMergeResolver } from "./task/mutation-task-merge/mutation-task-merge.resolver.ts";
import { mutationTaskFinishResolver } from "./task/mutation-task-finish/mutation-task-finish.resolver.ts";
import { queryGlobalStagesResolver } from "./stage/query-global-stages/query-global-stages.resolver.ts";
import { mutationStageSetResolver } from "./stage/mutation-stage-set/mutation-stage-set.resolver.ts";
import { mutationStageApproveResolver } from "./stage/mutation-stage-approve/mutation-stage-approve.resolver.ts";
import { queryConfigResolver } from "./config/query-config/query-config.resolver.ts";
import { queryBranchesResolver } from "./config/query-branches/query-branches.resolver.ts";
import { queryIntakeResolver } from "./intake/query-intake/query-intake.resolver.ts";
import { queryJobResolver } from "./job/query-job/query-job.resolver.ts";
import { querySearchResolver } from "./search/query-search/query-search.resolver.ts";
import { queryHealthResolver } from "./health/query-health/query-health.resolver.ts";

const operations: Array<{ Query?: Record<string, unknown>; Mutation?: Record<string, unknown> }> = [
  queryTasksResolver,
  queryTaskResolver,
  queryTaskStagesResolver,
  queryTaskJournalResolver,
  queryTaskBranchesResolver,
  mutationTaskCreateResolver,
  mutationTaskSwitchResolver,
  mutationTaskStartResolver,
  mutationTaskMergeResolver,
  mutationTaskFinishResolver,
  queryGlobalStagesResolver,
  mutationStageSetResolver,
  mutationStageApproveResolver,
  queryConfigResolver,
  queryBranchesResolver,
  queryIntakeResolver,
  queryJobResolver,
  querySearchResolver,
  queryHealthResolver,
];

const pick = (key: "Query" | "Mutation") =>
  Object.assign({}, ...operations.map((op) => op[key] ?? {}));

export const resolvers = {
  Query: pick("Query"),
  Mutation: pick("Mutation"),
  ...scalarResolver,
};
