/**
 * Small typed error for controllers/services to signal an HTTP status.
 * The central error handler reads `.status` to set the response code.
 */
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}
