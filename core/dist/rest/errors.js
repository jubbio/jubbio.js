"use strict";
/**
 * Custom error classes for REST API operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitError = exports.RESTError = void 0;
/**
 * Error thrown when a REST API request fails
 * Contains context about the failed request
 */
class RESTError extends Error {
    /** HTTP status code of the response */
    status;
    /** HTTP method used (GET, POST, PATCH, DELETE, PUT) */
    method;
    /** API endpoint path */
    path;
    /** Response body/error message */
    body;
    constructor(status, method, path, body) {
        super(`API Error ${status} ${method} ${path}: ${body}`);
        this.name = 'RESTError';
        this.status = status;
        this.method = method;
        this.path = path;
        this.body = body;
    }
}
exports.RESTError = RESTError;
/**
 * Error thrown when rate limit retries are exhausted
 * Extends RESTError with additional retry information
 */
class RateLimitError extends RESTError {
    /** Time in milliseconds until the rate limit resets */
    retryAfter;
    constructor(retryAfter, method, path) {
        super(429, method, path, `Rate limited for ${retryAfter}ms`);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}
exports.RateLimitError = RateLimitError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXJyb3JzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL3Jlc3QvZXJyb3JzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7R0FFRzs7O0FBRUg7OztHQUdHO0FBQ0gsTUFBYSxTQUFVLFNBQVEsS0FBSztJQUNsQyx1Q0FBdUM7SUFDaEMsTUFBTSxDQUFTO0lBQ3RCLHVEQUF1RDtJQUNoRCxNQUFNLENBQVM7SUFDdEIsd0JBQXdCO0lBQ2pCLElBQUksQ0FBUztJQUNwQixrQ0FBa0M7SUFDM0IsSUFBSSxDQUFTO0lBRXBCLFlBQVksTUFBYyxFQUFFLE1BQWMsRUFBRSxJQUFZLEVBQUUsSUFBWTtRQUNwRSxLQUFLLENBQUMsYUFBYSxNQUFNLElBQUksTUFBTSxJQUFJLElBQUksS0FBSyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3hELElBQUksQ0FBQyxJQUFJLEdBQUcsV0FBVyxDQUFDO1FBQ3hCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1FBQ3JCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO1FBQ2pCLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQ25CLENBQUM7Q0FDRjtBQWxCRCw4QkFrQkM7QUFFRDs7O0dBR0c7QUFDSCxNQUFhLGNBQWUsU0FBUSxTQUFTO0lBQzNDLHVEQUF1RDtJQUNoRCxVQUFVLENBQVM7SUFFMUIsWUFBWSxVQUFrQixFQUFFLE1BQWMsRUFBRSxJQUFZO1FBQzFELEtBQUssQ0FBQyxHQUFHLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxvQkFBb0IsVUFBVSxJQUFJLENBQUMsQ0FBQztRQUM3RCxJQUFJLENBQUMsSUFBSSxHQUFHLGdCQUFnQixDQUFDO1FBQzdCLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDO0lBQy9CLENBQUM7Q0FDRjtBQVRELHdDQVNDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEN1c3RvbSBlcnJvciBjbGFzc2VzIGZvciBSRVNUIEFQSSBvcGVyYXRpb25zXHJcbiAqL1xyXG5cclxuLyoqXHJcbiAqIEVycm9yIHRocm93biB3aGVuIGEgUkVTVCBBUEkgcmVxdWVzdCBmYWlsc1xyXG4gKiBDb250YWlucyBjb250ZXh0IGFib3V0IHRoZSBmYWlsZWQgcmVxdWVzdFxyXG4gKi9cclxuZXhwb3J0IGNsYXNzIFJFU1RFcnJvciBleHRlbmRzIEVycm9yIHtcclxuICAvKiogSFRUUCBzdGF0dXMgY29kZSBvZiB0aGUgcmVzcG9uc2UgKi9cclxuICBwdWJsaWMgc3RhdHVzOiBudW1iZXI7XHJcbiAgLyoqIEhUVFAgbWV0aG9kIHVzZWQgKEdFVCwgUE9TVCwgUEFUQ0gsIERFTEVURSwgUFVUKSAqL1xyXG4gIHB1YmxpYyBtZXRob2Q6IHN0cmluZztcclxuICAvKiogQVBJIGVuZHBvaW50IHBhdGggKi9cclxuICBwdWJsaWMgcGF0aDogc3RyaW5nO1xyXG4gIC8qKiBSZXNwb25zZSBib2R5L2Vycm9yIG1lc3NhZ2UgKi9cclxuICBwdWJsaWMgYm9keTogc3RyaW5nO1xyXG5cclxuICBjb25zdHJ1Y3RvcihzdGF0dXM6IG51bWJlciwgbWV0aG9kOiBzdHJpbmcsIHBhdGg6IHN0cmluZywgYm9keTogc3RyaW5nKSB7XHJcbiAgICBzdXBlcihgQVBJIEVycm9yICR7c3RhdHVzfSAke21ldGhvZH0gJHtwYXRofTogJHtib2R5fWApO1xyXG4gICAgdGhpcy5uYW1lID0gJ1JFU1RFcnJvcic7XHJcbiAgICB0aGlzLnN0YXR1cyA9IHN0YXR1cztcclxuICAgIHRoaXMubWV0aG9kID0gbWV0aG9kO1xyXG4gICAgdGhpcy5wYXRoID0gcGF0aDtcclxuICAgIHRoaXMuYm9keSA9IGJvZHk7XHJcbiAgfVxyXG59XHJcblxyXG4vKipcclxuICogRXJyb3IgdGhyb3duIHdoZW4gcmF0ZSBsaW1pdCByZXRyaWVzIGFyZSBleGhhdXN0ZWRcclxuICogRXh0ZW5kcyBSRVNURXJyb3Igd2l0aCBhZGRpdGlvbmFsIHJldHJ5IGluZm9ybWF0aW9uXHJcbiAqL1xyXG5leHBvcnQgY2xhc3MgUmF0ZUxpbWl0RXJyb3IgZXh0ZW5kcyBSRVNURXJyb3Ige1xyXG4gIC8qKiBUaW1lIGluIG1pbGxpc2Vjb25kcyB1bnRpbCB0aGUgcmF0ZSBsaW1pdCByZXNldHMgKi9cclxuICBwdWJsaWMgcmV0cnlBZnRlcjogbnVtYmVyO1xyXG5cclxuICBjb25zdHJ1Y3RvcihyZXRyeUFmdGVyOiBudW1iZXIsIG1ldGhvZDogc3RyaW5nLCBwYXRoOiBzdHJpbmcpIHtcclxuICAgIHN1cGVyKDQyOSwgbWV0aG9kLCBwYXRoLCBgUmF0ZSBsaW1pdGVkIGZvciAke3JldHJ5QWZ0ZXJ9bXNgKTtcclxuICAgIHRoaXMubmFtZSA9ICdSYXRlTGltaXRFcnJvcic7XHJcbiAgICB0aGlzLnJldHJ5QWZ0ZXIgPSByZXRyeUFmdGVyO1xyXG4gIH1cclxufVxyXG4iXX0=