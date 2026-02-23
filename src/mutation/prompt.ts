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
9. When mutating TypeScript/JavaScript, consider type narrowing, optional chaining, and nullish coalescing
10. Distribute mutations intelligently across files based on complexity and risk. Each mutation must include the filePath.

Before generating mutations, analyze the changed code to identify the critical behavioral invariants — the things that MUST be true for the code to work correctly. Then generate mutations that violate those invariants in subtle, plausible ways. Prioritize mutations that test:
- Edge cases and boundary conditions specific to the business logic
- Incorrect handling of specific domain values
- Subtle logic inversions that would silently produce wrong results
- Error conditions that could be swallowed or mishandled`;

const TYPE_CHECKED_SECTION = `

IMPORTANT — This project uses static type checking. Every mutation MUST produce code that would pass the type checker. Do NOT generate mutations that:
- Change type annotations without changing runtime behavior
- Assign values of incompatible types (e.g. None to a non-Optional field)
- Remove or alter type guards where the type system would reject the code
- Would cause a compilation or type-check error
Focus exclusively on behavioral mutations: logic errors, boundary mistakes, wrong return values — bugs that are type-correct but semantically wrong.`;

export interface PromptOptions {
  typeChecked?: boolean;
  commitMessages?: string;
}

const MAX_ANNOTATED_LINES = 500;
const CONTEXT_LINES_AROUND_HUNK = 30;
const MAX_EXPANSION_PER_FUNCTION = 100;

const FUNCTION_START_RE =
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\s+\w+|class\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\(|(?:public|private|protected|static|\w+)\s*\(|def\s+\w+|fn\s+\w+)/;

export function expandToFunctionBoundaries(
  lines: string[],
  visibleLines: Set<number>,
): Set<number> {
  const expanded = new Set(visibleLines);

  // Find contiguous ranges of visible lines
  const ranges: Array<[number, number]> = [];
  let rangeStart = -1;
  let rangePrev = -1;
  for (const lineNum of [...visibleLines].sort((a, b) => a - b)) {
    if (rangeStart === -1 || lineNum > rangePrev + 1) {
      if (rangeStart !== -1) ranges.push([rangeStart, rangePrev]);
      rangeStart = lineNum;
    }
    rangePrev = lineNum;
  }
  if (rangeStart !== -1) ranges.push([rangeStart, rangePrev]);

  for (const [start, end] of ranges) {
    // Scan upward to find function/class start
    let funcStart = start;
    for (let i = start - 1; i >= Math.max(1, start - MAX_EXPANSION_PER_FUNCTION); i--) {
      if (FUNCTION_START_RE.test(lines[i - 1])) {
        funcStart = i;
        break;
      }
    }

    // Scan downward to find matching closing brace
    let funcEnd = end;
    let braceDepth = 0;
    for (let i = funcStart; i <= Math.min(lines.length, end + MAX_EXPANSION_PER_FUNCTION); i++) {
      const line = lines[i - 1];
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        else if (ch === '}') braceDepth--;
      }
      if (i >= end && braceDepth <= 0) {
        funcEnd = i;
        break;
      }
    }

    for (let i = funcStart; i <= funcEnd; i++) {
      expanded.add(i);
    }
  }

  return expanded;
}

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

  // Expand to include full function bodies
  const expandedLines = expandToFunctionBoundaries(lines, visibleLines);

  const result: string[] = [];
  let lastShown = 0;

  for (let i = 1; i <= lines.length; i++) {
    if (expandedLines.has(i)) {
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

export function buildMultiFilePrompt(
  files: ChangedFile[],
  totalCount: number,
  options?: PromptOptions,
): Array<{ role: 'system' | 'user'; content: string }> {
  const fileSections = files
    .map((file) => {
      const annotated = buildAnnotatedContent(file);
      return `=== File: ${file.filePath} (${file.language}) ===

\`\`\`${file.language}
${annotated}
\`\`\``;
    })
    .join('\n\n');

  const systemContent = options?.typeChecked
    ? SYSTEM_PROMPT + TYPE_CHECKED_SECTION
    : SYSTEM_PROMPT;

  const commitSection =
    options?.commitMessages
      ? `## PR Context — Commit Messages
${options.commitMessages}

Use these commit messages to understand the intent of the changes. Focus mutations on the critical behavioral invariants that these changes introduce or modify.

`
      : '';

  return [
    { role: 'system', content: systemContent },
    {
      role: 'user',
      content: `${commitSection}Below are all changed files in this PR. Lines prefixed with [CHANGED] are within the git diff and are eligible for mutation. Lines prefixed with [CONTEXT] provide surrounding context but must NOT be mutated.

${fileSections}

Generate exactly ${totalCount} mutations across all files above. Distribute mutations intelligently based on complexity and risk. Each mutation must include the filePath field matching one of the file paths above.`,
    },
  ];
}
