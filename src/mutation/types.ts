export interface Mutation {
  id: string;
  filePath: string;
  startLine: number;
  endLine: number;
  originalCode: string;
  mutatedCode: string;
  description: string;
  category: string;
}

export interface MutationGenerationResult {
  mutations: Mutation[];
  tokenUsage: TokenUsage;
  retries: number;
}

export type MutationOutcome = 'killed' | 'survived' | 'no_coverage' | 'timeout' | 'error';

export interface MutationTestResult {
  mutation: Mutation;
  outcome: MutationOutcome;
  durationMs: number;
  testOutput?: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface PipelineResult {
  totalMutations: number;
  killed: number;
  survived: number;
  noCoverage: number;
  timedOut: number;
  errors: number;
  mutationScore: number;
  fileResults: FileResult[];
  totalTokenUsage: TokenUsage;
  durationMs: number;
}

export interface FileResult {
  filePath: string;
  results: MutationTestResult[];
  tokenUsage: TokenUsage;
}
