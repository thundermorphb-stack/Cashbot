// A tiny logger so every message has a timestamp and a level.
// Use log.info / log.warn / log.error instead of console.log everywhere.

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export const log = {
  info(...args: unknown[]) {
    console.log(`[${timestamp()}] [INFO]`, ...args);
  },
  warn(...args: unknown[]) {
    console.warn(`[${timestamp()}] [WARN]`, ...args);
  },
  error(...args: unknown[]) {
    console.error(`[${timestamp()}] [ERROR]`, ...args);
  },
};
