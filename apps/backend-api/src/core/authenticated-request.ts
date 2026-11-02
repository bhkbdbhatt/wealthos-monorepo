/** Execution context principal available on req.user after JwtAuthGuard. */
import type { JwtPayload } from '@wealthos/shared-types';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
