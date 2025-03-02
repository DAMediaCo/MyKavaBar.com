import { createLogger } from "vite";

const viteLogger = createLogger();

export function log(message: string, source = "server") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export const logger = {
  ...viteLogger,
  info: (msg: string) => log(msg, "info"),
  error: (msg: string) => {
    log(`ERROR: ${msg}`, "error");
    viteLogger.error(msg);
  },
  warn: (msg: string) => log(msg, "warn"),
  debug: (msg: string) => log(msg, "debug"),
};
