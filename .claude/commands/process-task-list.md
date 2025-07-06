# /process-tasks

**Description:** Processes and implements tasks from an existing task list for a feature, following strict completion protocols and maintaining progress tracking.

**Usage:** `/process-tasks <feature-name>`

**Example:** `/process-tasks user-profile-editing`

---

## Rule: Task List Management and Implementation

### Goal

To guide an AI assistant in systematically implementing tasks from an existing task list while maintaining proper progress tracking, testing protocols, and version control practices.

### Process

1. **Extract Feature Name:** Use the provided feature name from `$ARGUMENTS`
2. **Derive Task File:** Convert the feature name to task filename format: `tasks-prd-$ARGUMENTS.md`
3. **Locate and Load Task List:** Find and read the derived task file in the `/tasks/` directory
4. **Identify Next Task:** Analyze the task list to find the next uncompleted sub-task
5. **Begin Implementation:** Start working on the identified sub-task following the implementation protocol
6. **Maintain Progress:** Update the task list file as work progresses

### Task Implementation Protocol

- **One sub-task at a time:** Do **NOT** start the next sub‑task until you ask the user for permission and they say "yes" or "y"
- **Completion protocol:**  
  1. When you finish a **sub‑task**, immediately mark it as completed by changing `[ ]` to `[x]`.
  2. If **all** subtasks underneath a parent task are now `[x]`, follow this sequence:
    - **First**: Run the full test suite (`pytest`, `npm test`, `bin/rails test`, etc.)
    - **Only if all tests pass**: Stage changes (`git add .`)
    - **Clean up**: Remove any temporary files and temporary code before committing
    - **Commit**: Use a descriptive commit message that:
      - Uses conventional commit format (`feat:`, `fix:`, `refactor:`, etc.)
      - Summarizes what was accomplished in the parent task
      - Lists key changes and additions
      - References the task number and PRD context
      - **Formats the message as a single-line command using `-m` flags**, e.g.:

        ```
        git commit -m "feat: add payment validation logic" -m "- Validates card type and expiry" -m "- Adds unit tests for edge cases" -m "Related to T123 in PRD"
        ```
  3. Once all the subtasks are marked completed and changes have been committed, mark the **parent task** as completed.
- Stop after each sub‑task and wait for the user's go‑ahead.

### Task List Maintenance Requirements

1. **Update the task list as you work:**
   - Mark tasks and subtasks as completed (`[x]`) per the protocol above
   - Add new tasks as they emerge during implementation

2. **Maintain the "Relevant Files" section:**
   - List every file created or modified
   - Give each file a one‑line description of its purpose
   - Keep this section accurate and up to date

### AI Implementation Instructions

When working with task lists, the AI must:

1. **Before starting work:** Check which sub‑task is next in the sequence
2. **During implementation:** 
   - Focus on one sub-task at a time
   - Follow coding best practices and maintain code quality
   - Create or update relevant test files as needed
3. **After implementing a sub‑task:** 
   - Update the task list file immediately
   - Mark the completed sub-task as `[x]`
   - Update the "Relevant Files" section if new files were created/modified
   - Pause and ask for user approval before proceeding
4. **Parent task completion:**
   - Only mark parent task as complete when ALL subtasks are finished
   - Run full test suite before final commit
   - Follow the git commit protocol exactly as specified
5. **Continuous maintenance:**
   - Regularly save updates to the task list file
   - Add newly discovered tasks as they become apparent
   - Keep progress tracking accurate throughout the process

### Command Behavior

When this slash command is invoked:

1. Acknowledge the feature name provided in `$ARGUMENTS`
2. Derive and locate the task file: `tasks-prd-$ARGUMENTS.md`
3. Load and analyze the current task list state
4. Identify the next uncompleted sub-task in sequence
5. Present the next sub-task to be implemented
6. Begin implementation following the strict one-task-at-a-time protocol
7. Update task progress and maintain file accuracy throughout
8. Follow completion protocols including testing and version control
9. Continuously ask for user permission before proceeding to next sub-tasks

### Error Handling

- If the derived task file (`tasks-prd-$ARGUMENTS.md`) is not found, inform the user and suggest generating tasks first with `/generate-tasks <feature-name>`
- If the task file exists but has no remaining tasks, inform the user that all tasks are complete
- If tests fail during the completion protocol, do not proceed with git operations and report the failure
- If git operations fail, report the specific error and request guidance

### Success Criteria

- All sub-tasks are completed systematically and marked as `[x]`
- All parent tasks are properly completed following the protocol
- Test suite passes at each parent task completion
- Git commits follow the specified conventional format
- Task list file remains accurate and up-to-date throughout the process
- "Relevant Files" section reflects all created/modified files