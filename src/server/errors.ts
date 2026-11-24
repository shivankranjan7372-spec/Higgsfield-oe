/**
 * The one error type API routes turn into a response:
 *
 *   { "error": { "code": "insufficient_credits", "message": "..." } }
 *
 * `message` is shown to the member as is, so write it for them.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new ApiError(400, "invalid_request", message);
export const notFound = (what = "Not found.") => new ApiError(404, "not_found", what);
