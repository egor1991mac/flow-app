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
  query BranchNames($parentId: String, $part: String) {
    branchNames(parentId: $parentId, part: $part)
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

export const MUTATION_EDIT_TASK = gql`
  ${INVOKE_FIELDS}
  mutation EditTask($input: EditTaskInput!) {
    editTask(input: $input) {
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

export const QUERY_TASK_GIT = gql`
  query TaskGit($id: String!) {
    taskGit(taskId: $id) {
      repo
      branch
      base
      dir
      commits {
        hash
        subject
        author
        date
      }
      mrs {
        iid
        title
        state
        url
        sourceBranch
        targetBranch
      }
    }
  }
`;

export const MUTATION_LAUNCH_AGENT = gql`
  ${INVOKE_FIELDS}
  mutation LaunchAgent($id: String!) {
    launchAgent(id: $id) {
      ...InvokeFields
    }
  }
`;

export const MUTATION_COMMIT_TASK = gql`
  ${INVOKE_FIELDS}
  mutation CommitTask($id: String!, $subject: String, $type: String, $repo: String) {
    commitTask(id: $id, subject: $subject, type: $type, repo: $repo) {
      ...InvokeFields
    }
  }
`;

export const MUTATION_CREATE_TASK_MR = gql`
  ${INVOKE_FIELDS}
  mutation CreateTaskMr($id: String!, $repo: String) {
    createTaskMr(id: $id, repo: $repo) {
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

export const QUERY_YT_BOARD = gql`
  query YtBoard($query: String!, $limit: Int) {
    ytBoard(query: $query, limit: $limit) {
      ok
      error
      truncated
      issues {
        id
        summary
        state
        assignee
        assigneeLogin
        priority
        type
        project
        updated
        url
      }
    }
  }
`;

export const QUERY_YT_SPRINTS = gql`
  query YtSprints {
    ytSprints {
      ok
      error
      boardId
      current {
        id
        name
        start
        finish
        current
      }
      sprints {
        id
        name
        start
        finish
        current
      }
    }
  }
`;

export const QUERY_YT_USERS = gql`
  query YtUsers($query: String, $limit: Int) {
    ytUsers(query: $query, limit: $limit) {
      ok
      error
      users {
        login
        name
      }
    }
  }
`;

export const QUERY_YT_GRILL = gql`
  query YtGrill($slug: String!) {
    ytGrill(slug: $slug) {
      path
      content
    }
  }
`;

export const MUTATION_YT_CREATE_ISSUE = gql`
  mutation YtCreateIssue($input: YtCreateIssueInput!) {
    ytCreateIssue(input: $input) {
      ok
      error
      id
      url
      warnings
    }
  }
`;

export const MUTATION_LAUNCH_GRILL = gql`
  mutation LaunchGrill($slug: String!, $prompt: String!) {
    launchGrill(slug: $slug, prompt: $prompt) {
      ok
      error
      path
    }
  }
`;
