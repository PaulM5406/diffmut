import type { ChangedFile } from '../diff/types.js';

const SYSTEM_PROMPT = `You are a mutation testing expert. Your job is to generate subtle, realistic code mutations that test the quality of a project's test suite.

A good mutation:
- Changes the BEHAVIOR of the code in a way that a well-written test should detect
- Is syntactically valid and would compile/run without syntax errors
- Represents a mistake a real developer could plausibly make
- Is confined to the specific lines indicated in the diff

A bad mutation:
- Deletes entire functions or blocks (too obvious)
- Introduces syntax errors (not testing logic)
- Changes only comments, whitespace, or formatting
- Changes code outside the specified changed lines
- Is equivalent to the original (does not change behavior)

Mutation categories to consider:
- boundary-condition: Change < to <=, > to >=, off-by-one errors
- logical-operator: Swap && with ||, negate conditions
- null-safety: Remove null checks, change nullish coalescing
- error-handling: Remove try/catch, change error types, swallow errors
- return-value: Change return values, return early, return wrong type
- conditional-logic: Invert if conditions, remove else branches
- off-by-one: Change loop bounds, array indices
- string-manipulation: Change string comparisons, regex patterns
- type-coercion: Change strict equality to loose, remove type guards
- api-contract: Change function signatures, swap parameters

Rules:
1. ONLY mutate lines within the changed regions marked with [CHANGED] markers
2. Each mutation must specify the exact original code being replaced
3. The originalCode field must match the file content EXACTLY (including whitespace and indentation)
4. Provide a clear description of what the mutation tests
5. Generate exactly the requested number of mutations (or fewer if the diff is too small)
6. Prefer diverse mutation categories — do not generate multiple mutations of the same category
7. Consider the SEMANTICS of the code, not just syntactic transformations
8. When mutating Python code, consider Pythonic patterns like list comprehensions, context managers, and truthiness
9. When mutating TypeScript/JavaScript, consider type narrowing, optional chaining, and nullish coalescing`;

const MAX_ANNOTATED_LINES = 500;
const CONTEXT_LINES_AROUND_HUNK = 30;

export function buildAnnotatedContent(file: ChangedFile): string {
  const lines = file.currentContent.split('\n');
  const changedLineNumbers = new Set<number>();

  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      changedLineNumbers.add(line.lineNumber);
    }
  }

  // If the file is small enough, annotate every line
  if (lines.length <= MAX_ANNOTATED_LINES) {
    return lines
      .map((line, i) => {
        const lineNum = i + 1;
        const prefix = changedLineNumbers.has(lineNum) ? '[CHANGED]' : '[CONTEXT]';
        return `${String(lineNum).padStart(4)} ${prefix} ${line}`;
      })
      .join('\n');
  }

  // For large files, show only hunks with context
  const visibleLines = new Set<number>();
  for (const hunk of file.hunks) {
    const hunkStart = hunk.startLine;
    const hunkEnd = hunk.startLine + hunk.lineCount - 1;
    for (
      let i = Math.max(1, hunkStart - CONTEXT_LINES_AROUND_HUNK);
      i <= Math.min(lines.length, hunkEnd + CONTEXT_LINES_AROUND_HUNK);
      i++
    ) {
      visibleLines.add(i);
    }
  }

  // Always show first few lines (imports)
  for (let i = 1; i <= Math.min(10, lines.length); i++) {
    visibleLines.add(i);
  }

  const result: string[] = [];
  let lastShown = 0;

  for (let i = 1; i <= lines.length; i++) {
    if (visibleLines.has(i)) {
      if (lastShown > 0 && i - lastShown > 1) {
        result.push(`     ... (${i - lastShown - 1} lines omitted) ...`);
      }
      const prefix = changedLineNumbers.has(i) ? '[CHANGED]' : '[CONTEXT]';
      result.push(`${String(i).padStart(4)} ${prefix} ${lines[i - 1]}`);
      lastShown = i;
    }
  }

  if (lastShown < lines.length) {
    result.push(`     ... (${lines.length - lastShown} lines omitted) ...`);
  }

  return result.join('\n');
}

export function buildPrompt(
  file: ChangedFile,
  count: number,
): Array<{ role: 'system' | 'user'; content: string }> {
  const annotated = buildAnnotatedContent(file);

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `File: ${file.filePath}
Language: ${file.language}

Below is the file content with changed regions marked. Lines prefixed with [CHANGED] are within the git diff and are eligible for mutation. Lines prefixed with [CONTEXT] provide surrounding context but must NOT be mutated.

\`\`\`${file.language}
${annotated}
\`\`\`

Generate exactly ${count} mutations for the [CHANGED] lines in this file.`,
    },
  ];
}
