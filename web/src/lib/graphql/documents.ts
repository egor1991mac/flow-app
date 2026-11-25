import { gql } from "@apollo/client";

const TASK_FIELDS = gql`
  fragment TaskFields on Task {
    id
    type
    parentId
    parentExternal
    titleRu
    description
    branch
    workspacePath
    repos
    activeRepos
    slot
    dockerProject
    ports
    endpoints
    status
    mode
    bases
    createdAt
    children
  }
`;

const STAGES_FIELDS = gql`
  fragment StagesFields on StagesFile {
    version
    scope
    taskId
    currentStage
    stages {
      stage
      status
      runs {
        runId
        startedAt
        finishedAt
        report
        evidence {
          id
          text
          checked
        }
      }
      approvals {
        stage
        approvedBy
        approvedAt
        phrase
        source
        runId
      }
    }
  }
`;

const JOURNAL_FIELDS = gql`
  fragment JournalFields on JournalData {
    journal {
      id
      ts
      event
      details
    }
    decisions {
      id
      ts
      stage
      point
      input
      choice
      why
      actor
    }
  }
`;

const BRANCH_FIELDS = gql`
  fragment BranchFields on Branch {
    repo
    branch
    url
    base
    baseUrl
  }
`;

const INVOKE_FIELDS = gql`
  fragment InvokeFields on InvokeOutcome {
    ok
    output
    error
    err
  }
`;

export const QUERY_TASKS = gql`
  ${TASK_FIELDS}
  query Tasks {
    tasks {
      ...TaskFields
    }
  }
`;

export const QUERY_TASK = gql`
  ${TASK_FIELDS}
  query Task($id: String!) {
    task(id: $id) {
      ...TaskFields
    }
  }
`;

export const QUERY_TASK_DETAIL = gql`
  ${TASK_FIELDS}
  ${STAGES_FIELDS}
  ${JOURNAL_FIELDS}
  ${BRANCH_FIELDS}
  query TaskDetail($id: String!) {
    task(id: $id) {
      ...TaskFields
    }
    taskStages(taskId: $id) {
      ...StagesFields
    }
    taskJournal(taskId: $id) {
      ...JournalFields
    }
    taskBranches(taskId: $id) {
      ...BranchFields
    }
  }
`;

export const QUERY_JOB = gql`
  query Job($id: String!) {
    job(id: $id) {
      log
      done
      code
    }
  }
`;

export const QUERY_CONFIG = gql`
  query Config {
    config {
      version
      workspacesRoot
      donorsRoot
      mainRoot
      toolkitDir
      offsetStep
      maxSlots
      repos
    }
  }
`;

export const QUERY_BRANCH_NAMES = gql`
  query BranchNames($parentId: String) {
    branchNames(parentId: $parentId)
  }
`;

export const QUERY_INTAKE = gql`
  query Intake($input: String!) {
    intake(input: $input) {
      ok
      id
      type
      ytType
      state
      summary
      description
      parentId
      parentError
      parentSource
      branchName
      titleRu
      error
    }
  }
`;

export const QUERY_SEARCH = gql`
  query Search($q: String!) {
    search(q: $q) {
      ok
      indexed
      results {
        taskId
        kind
        snippet
        score
        ts
      }
    }
  }
`;

export const MUTATION_CREATE_TASK = gql`
  ${INVOKE_FIELDS}
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      ...InvokeFields
      autoFeature
    }
  }
`;

export const MUTATION_SWITCH_TASK = gql`
  ${INVOKE_FIELDS}
  mutation SwitchTask($input: SwitchTaskInput!) {
    switchTask(input: $input) {
      ...InvokeFields
    }
  }
`;

export const MUTATION_START_TASK = gql`
  ${INVOKE_FIELDS}
  mutation StartTask($id: String!, $start: Boolean) {
    startTask(id: $id, start: $start) {
      ...InvokeFields
      jobId
    }
  }
`;

export const MUTATION_MERGE_TASK = gql`
  ${INVOKE_FIELDS}
  mutation MergeTask($id: String!, $yes: Boolean) {
    mergeTask(id: $id, yes: $yes) {
      ...InvokeFields
    }
  }
`;

export const MUTATION_FINISH_TASK = gql`
  ${INVOKE_FIELDS}
  mutation FinishTask($id: String!, $yes: Boolean, $dryRun: Boolean) {
    finishTask(id: $id, yes: $yes, dryRun: $dryRun) {
      ...InvokeFields
    }
  }
`;

export const MUTATION_SET_STAGE = gql`
  ${INVOKE_FIELDS}
  mutation SetStage($input: StageInput!) {
    setStage(input: $input) {
      ...InvokeFields
    }
  }
`;

export const MUTATION_APPROVE_STAGE = gql`
  ${INVOKE_FIELDS}
  mutation ApproveStage($input: ApproveStageInput!) {
    approveStage(input: $input) {
      ...InvokeFields
    }
  }
`;
