export class AppError extends Error {
  constructor(public code: string, message: string, public cause?: unknown) {
    super(message);
    this.name = new.target.name;
  }
}
export class NotFoundError extends AppError {
  constructor(what: string) { super("NOT_FOUND", `${what} not found`); }
}
export class QueryError extends AppError {
  constructor(where: string, cause?: unknown) { super("QUERY_FAILED", `Query failed: ${where}`, cause); }
}
export class ValidationError extends AppError {
  constructor(public fields: Record<string, string[]>) {
    super("VALIDATION", "Some answers need attention.");
  }
}
export class RateLimitError extends AppError {
  constructor(public retryAfterSeconds: number) {
    super("RATE_LIMITED", "You have sent several requests recently. Please try again shortly.");
  }
}
export class AuthError extends AppError {
  constructor(message = "You do not have access to this.") { super("FORBIDDEN", message); }
}
