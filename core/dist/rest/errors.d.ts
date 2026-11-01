/**
 * Custom error classes for REST API operations
 */
/**
 * Error thrown when a REST API request fails
 * Contains context about the failed request
 */
export declare class RESTError extends Error {
    /** HTTP status code of the response */
    status: number;
    /** HTTP method used (GET, POST, PATCH, DELETE, PUT) */
    method: string;
    /** API endpoint path */
    path: string;
    /** Response body/error message */
    body: string;
    constructor(status: number, method: string, path: string, body: string);
}
/**
 * Error thrown when rate limit retries are exhausted
 * Extends RESTError with additional retry information
 */
export declare class RateLimitError extends RESTError {
    /** Time in milliseconds until the rate limit resets */
    retryAfter: number;
    constructor(retryAfter: number, method: string, path: string);
}
