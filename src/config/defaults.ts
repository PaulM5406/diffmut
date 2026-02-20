export const CONFIG_FILE_NAMES = [
  '.diffmutrc.json',
  '.diffmutrc.yml',
  '.diffmutrc.yaml',
];

export const DEFAULTS = {
  diffBase: 'origin/main',
  mutations: 5,
  model: 'gpt-4o',
  timeout: 300,
  output: 'text' as const,
  failOnSurvived: false,
  dryRun: false,
};
