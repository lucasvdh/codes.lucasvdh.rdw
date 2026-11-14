export class RdwError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** RDW answered with a status the app can't use. */
export class RdwHttpError extends RdwError {
  constructor(readonly statusCode: number) {
    super(`RDW responded with HTTP ${statusCode}`);
  }
}

/** RDW answered, but not with JSON. */
export class RdwResponseError extends RdwError {}

/** RDW didn't answer in time. */
export class RdwTimeoutError extends RdwError {
  constructor(readonly timeoutMs: number) {
    super(`RDW did not answer within ${timeoutMs} ms`);
  }
}
