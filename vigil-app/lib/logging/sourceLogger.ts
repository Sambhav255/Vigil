type SourceLogMeta = Record<string, unknown>;

export function logSourceFailure(source: string, message: string, meta?: SourceLogMeta) {
  // Structured logs are easy to parse in local/dev and server logs.
  console.error(
    JSON.stringify({
      type: "source_failure",
      source,
      message,
      meta: meta ?? {},
      ts: Date.now(),
    })
  );
}
