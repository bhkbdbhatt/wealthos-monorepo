import {
  type ArgumentsHost,
  type ExceptionFilter,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Stable error envelope: { ok:false, error:{ code, message, details } }. */
export interface ApiErrorBody {
  statusCode: number;
  errorCode: string;
  message: string;
}

export function errorCodeFor(status: HttpStatus): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'BAD_REQUEST';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'UNPROCESSABLE';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    case HttpStatus.REQUEST_TIMEOUT:
      return 'REQUEST_TIMEOUT';
    case HttpStatus.PAYLOAD_TOO_LARGE:
      return 'PAYLOAD_TOO_LARGE';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'DEPENDENCY_UNAVAILABLE';
    case HttpStatus.INTERNAL_SERVER_ERROR:
    default:
      return 'INTERNAL';
  }
}

function messageOf(exception: HttpException): string {
  const response = exception.getResponse();
  if (typeof response === 'string') return response;
  if (typeof response === 'object' && response !== null && 'message' in response) {
    const messages = (response as { message: unknown }).message;
    if (typeof messages === 'string') return messages;
    if (Array.isArray(messages)) return messages.filter((m) => typeof m === 'string').join('; ');
  }
  return exception.message;
}

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiErrorFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{ status(code: number): { json(body: unknown): void } }>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let payload: ApiErrorBody | null = null;
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      payload = {
        statusCode: status,
        errorCode: errorCodeFor(status),
        message: messageOf(exception),
      };
    }
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = exception.code === 'P2002' ? HttpStatus.CONFLICT : HttpStatus.SERVICE_UNAVAILABLE;
      payload = {
        statusCode: status,
        errorCode: status === HttpStatus.CONFLICT ? 'CONFLICT' : 'DEPENDENCY_UNAVAILABLE',
        message: status === HttpStatus.CONFLICT ? 'The resource already exists' : 'A required service is temporarily unavailable',
      };
    } else if (exception instanceof Prisma.PrismaClientInitializationError || exception instanceof Prisma.PrismaClientRustPanicError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      payload = {
        statusCode: status,
        errorCode: 'DEPENDENCY_UNAVAILABLE',
        message: 'A required service is temporarily unavailable',
      };
    }

    if (payload !== null) {
      response.status(status).json({ ok: false, data: null, error: payload });
      return;
    }
    if (exception instanceof Error) {
      // Do NOT include raw error text: may contain PII.
      this.logger.error(`Unhandled error: ${exception.name}`, exception.stack);
    }
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      ok: false,
      data: null,
      error: { statusCode: 500, errorCode: 'INTERNAL', message: 'Something went wrong' },
    });
  }
}
