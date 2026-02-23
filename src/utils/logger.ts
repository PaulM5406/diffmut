import pc from 'picocolors';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export const logger = {
  level: 'info' as LogLevel,

  shouldLog(level: LogLevel): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[this.level];
  },

  debug(msg: string): void {
    if (this.shouldLog('debug')) {
      console.error(pc.dim(`[debug] ${msg}`));
    }
  },

  info(msg: string): void {
    if (this.shouldLog('info')) {
      console.error(msg);
    }
  },

  warn(msg: string): void {
    if (this.shouldLog('warn')) {
      console.error(pc.yellow(`⚠ ${msg}`));
    }
  },

  error(msg: string): void {
    if (this.shouldLog('error')) {
      console.error(pc.red(`✖ ${msg}`));
    }
  },
};
