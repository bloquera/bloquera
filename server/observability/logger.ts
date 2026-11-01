import "server-only";

type LogLevel = "error" | "info" | "warn";

type LogFields = Record<
  string,
  boolean | number | string | null | undefined
>;

function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return { errorType: "unknown" };
  }

  return {
    errorMessage: error.message.slice(0, 500),
    errorName: error.name,
  };
}

function writeLog(level: LogLevel, event: string, fields: LogFields = {}) {
  const entry = JSON.stringify({
    event,
    level,
    service: "bloquera-web",
    timestamp: new Date().toISOString(),
    ...fields,
  });

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.info(entry);
}

export function getRequestId(request: Request) {
  return (
    request.headers.get("x-request-id") ??
    request.headers.get("x-vercel-id") ??
    crypto.randomUUID()
  );
}

export function logError(
  event: string,
  error: unknown,
  fields: LogFields = {},
) {
  writeLog("error", event, { ...fields, ...serializeError(error) });
}

export function logInfo(event: string, fields: LogFields = {}) {
  writeLog("info", event, fields);
}

export function logWarn(event: string, fields: LogFields = {}) {
  writeLog("warn", event, fields);
}
