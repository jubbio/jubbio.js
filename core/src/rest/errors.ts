/**
 * Custom error classes for REST API operations
 */

/**
 * Error thrown when a REST API request fails
 * Contains context about the failed request
 */
export class RESTError extends Error {
  /** HTTP status code of the response */
  public status: number;
  /** HTTP method used (GET, POST, PATCH, DELETE, PUT) */
  public method: string;
  /** API endpoint path */
  public path: string;
  /** Response body/error message */
  public body: string;

  constructor(status: number, method: string, path: string, body: string) {
    super(`API Error ${status} ${method} ${path}: ${body}`);
    this.name = 'RESTError';
    this.status = status;
    this.method = method;
    this.path = path;
    this.body = body;
  }
}

/**
 * Error thrown when rate limit retries are exhausted
 * Extends RESTError with additional retry information
 */
export class RateLimitError extends RESTError {
  /** Time in milliseconds until the rate limit resets */
  public retryAfter: number;

  constructor(retryAfter: number, method: string, path: string) {
    super(429, method, path, `Rate limited for ${retryAfter}ms`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}
