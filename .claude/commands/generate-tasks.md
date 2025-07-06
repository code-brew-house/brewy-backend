# /generate-tasks

**Description:** Generates a detailed, step-by-step task list from an existing Product Requirements Document (PRD) to guide developer implementation.

**Usage:** `/generate-tasks <feature-name>`

**Example:** `/generate-tasks user-profile-editing`

---

## Rule: Generating a Task List from a PRD

### Goal

To guide an AI assistant in creating a detailed, step-by-step task list in Markdown format based on an existing Product Requirements Document (PRD). The task list should guide a developer through implementation.

### Output

- **Format:** Markdown (`.md`)
- **Location:** `/tasks/`
- **Filename:** `tasks-prd-[feature-name].md` (e.g., `tasks-prd-user-profile-editing.md`)

### Process

1. **Extract Feature Name:** Use the provided feature name from `$ARGUMENTS`
2. **Derive PRD Filename:** Convert the feature name to PRD filename format: `prd-[feature-name].md`
3. **Locate and Read PRD:** Find and analyze the derived PRD file in the `/tasks/` directory
4. **Analyze PRD:** Read and analyze the functional requirements, user stories, and other sections of the specified PRD
5. **Phase 1: Generate Parent Tasks:** Based on the PRD analysis, create the file and generate the main, high-level tasks required to implement the feature. Use your judgement on how many high-level tasks to use. It's likely to be about 5. Present these tasks to the user in the specified format (without sub-tasks yet). Inform the user: "I have generated the high-level tasks based on the PRD. Ready to generate the sub-tasks? Respond with 'Go' to proceed."
6. **Wait for Confirmation:** Pause and wait for the user to respond with "Go"
7. **Phase 2: Generate Sub-Tasks:** Once the user confirms, break down each parent task into smaller, actionable sub-tasks necessary to complete the parent task. Ensure sub-tasks logically follow from the parent task and cover the implementation details implied by the PRD
8. **Identify Relevant Files:** Based on the tasks and PRD, identify potential files that will need to be created or modified. List these under the `Relevant Files` section, including corresponding test files if applicable
9. **Generate Final Output:** Combine the parent tasks, sub-tasks, relevant files, and notes into the final Markdown structure
10. **Save Task List:** Save the generated document in the `/tasks/` directory with the filename `tasks-prd-[feature-name].md`

### Output Format

The generated task list _must_ follow this structure:

```markdown
## Relevant Files

- `path/to/potential/file1.ts` - Brief description of why this file is relevant (e.g., Contains the main component for this feature).
- `path/to/file1.test.ts` - Unit tests for `file1.ts`.
- `path/to/another/file.tsx` - Brief description (e.g., API route handler for data submission).
- `path/to/another/file.test.tsx` - Unit tests for `another/file.tsx`.
- `lib/utils/helpers.ts` - Brief description (e.g., Utility functions needed for calculations).
- `lib/utils/helpers.test.ts` - Unit tests for `helpers.ts`.

### Notes

- Unit tests should typically be placed alongside the code files they are testing (e.g., `MyComponent.tsx` and `MyComponent.test.tsx` in the same directory).
- Add necessary unit tests and integration tests for each Parent Task.
- Use `npx jest [optional/path/to/test/file]` to run tests. Running without a path executes all tests found by the Jest configuration.

## Tasks

- [ ] 1.0 Parent Task Title
  - [ ] 1.1 [Sub-task description 1.1]
  - [ ] 1.2 [Sub-task description 1.2]
- [ ] 2.0 Parent Task Title
  - [ ] 2.1 [Sub-task description 2.1]
- [ ] 3.0 Parent Task Title (may not require sub-tasks if purely structural or configuration)
```

### Interaction Model

The process explicitly requires a pause after generating parent tasks to get user confirmation ("Go") before proceeding to generate the detailed sub-tasks. This ensures the high-level plan aligns with user expectations before diving into details.

### Target Audience

Assume the primary reader of the task list is a **junior developer** who will implement the feature.

### Command Behavior

When this slash command is invoked:

1. Acknowledge the feature name provided in `$ARGUMENTS`
2. Derive the PRD filename as `prd-[feature-name].md`
3. Locate and read the derived PRD file from `/tasks/` directory
4. Analyze the PRD content and functional requirements
5. Generate high-level parent tasks (typically ~5 tasks)
6. Present parent tasks and wait for user confirmation ("Go")
7. Upon confirmation, generate detailed sub-tasks for each parent task
8. Identify relevant files that need creation or modification
9. Generate the complete task list following the specified format
10. Save the task list as `tasks-prd-[feature-name].md` in `/tasks/` directory

### Error Handling

- If the derived PRD file (`prd-[feature-name].md`) is not found, inform the user and suggest available PRD files
- If the PRD file exists but is incomplete or malformed, ask for clarification before proceeding
- Ensure the output filename correctly follows the pattern: `tasks-prd-[feature-name].md`