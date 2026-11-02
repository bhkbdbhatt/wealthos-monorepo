import { PiiCipher } from '../../core/pii-cipher';
import type { Prisma } from '@prisma/client';
import type { UserDto } from '@wealthos/shared-types';

type UserRow = Prisma.UserGetPayload<object>;

/** Maps a Prisma User row to the shared UserDto, decrypting phone for owner reads. */
export function toUserDto(user: UserRow, piiCipher: PiiCipher): UserDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: piiCipher.decrypt(user.phoneEnc ?? ''),
    role: user.role as UserDto['role'],
    status: user.status as UserDto['status'],
    createdAt: (user.createdAt as Date).toISOString(),
  };
}
