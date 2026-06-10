# Student Answer Split Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the scanned student question on the left and the answer form on the right on wide screens, while preserving mobile usability.

**Architecture:** Extract a small presentational student answer layout component from the current `/student/[token]` page markup. The page keeps data loading and submission state; the layout component renders the two-pane structure and delegates answer controls to `QuestionRenderer`.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Grid, Vitest static rendering tests.

---

## File Structure

- Create `src/components/StudentAnswerLayout.tsx` for the presentational two-pane layout.
- Modify `src/app/student/[token]/page.tsx` to render `StudentAnswerLayout`.
- Modify `src/app/globals.css` for `.studentWorkspace`, `.studentQuestionPane`, and `.studentAnswerPane`.
- Modify `tests/ui/student.test.tsx` to add a static rendering test for pane order.

## Task 1: Layout Component

**Files:**
- Create: `src/components/StudentAnswerLayout.tsx`
- Modify: `tests/ui/student.test.tsx`

- [ ] **Step 1: Write the failing test**

Add a test that renders `StudentAnswerLayout` with a sample active blank question and asserts:

```ts
expect(html).toContain('data-testid="student-question-pane"');
expect(html).toContain('data-testid="student-answer-pane"');
expect(html.indexOf('data-testid="student-question-pane"')).toBeLessThan(
  html.indexOf('data-testid="student-answer-pane"'),
);
expect(html).toContain('data-testid="student-name-input"');
expect(html).toContain('data-testid="answer-input-0"');
```

- [ ] **Step 2: Verify the test fails**

Run: `npm run test -- tests/ui/student.test.tsx`

Expected: fail because `@/components/StudentAnswerLayout` does not exist.

- [ ] **Step 3: Implement the component**

Move the existing loaded-state form markup into `StudentAnswerLayout`, with separate semantic sections:

- `studentQuestionPane` for the prompt.
- `studentAnswerPane` for identity fields, answer controls, status messages, and submit button.

- [ ] **Step 4: Verify the test passes**

Run: `npm run test -- tests/ui/student.test.tsx`

Expected: all student UI tests pass.

## Task 2: Page Wiring And CSS

**Files:**
- Modify: `src/app/student/[token]/page.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Wire the component**

Replace the current loaded-state `<form className="studentCard">...</form>` block with `StudentAnswerLayout`, passing the existing state, handlers, and derived booleans.

- [ ] **Step 2: Add responsive CSS**

Use CSS Grid:

- `.studentWorkspace`: two columns `minmax(0, 1fr) minmax(320px, 420px)` on wide screens.
- `.studentQuestionPane` and `.studentAnswerPane`: white panels with border, 8px radius, and existing spacing.
- At `max-width: 860px`, `.studentWorkspace` becomes one column.

- [ ] **Step 3: Verify behavior**

Run:

```powershell
npm run test
npm run lint
npm run build
```

Expected: all commands pass.
