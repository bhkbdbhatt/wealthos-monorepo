import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '@wealthos/database';
import { User } from '@prisma/client';
import { UserRole } from '@wealthos/shared-types';
import { PiiCipher } from '../../core/pii-cipher';
import { toUserDto } from '../users/users.mapper';
import { type AuthSessionDto, type RegisterClientInput } from './auth.dto';
import { type TokenFactory } from './token.factory';

/**
 * Login, CLIENT self-registration, refresh-token rotation.
 * Passwords are never stored in plaintext (bcrypt, cost 10).
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenFactory,
    private readonly piiCipher: PiiCipher,
  ) {}

  /**
   * @param email login email (unique)
   * @param password plaintext credential
   * @returns session DTO: user + token pair
   */
  async login(email: string, password: string): Promise<AuthSessionDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');
    if (user.status === 'SUSPENDED') throw new ForbiddenException('Account suspended');
    if (!bcrypt.compareSync(password, user.passwordHash)) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const tokens = this.tokens.signPair(claimSubset(user));
    return { user: toUserDto(user, this.piiCipher), tokens };
  }

  /**
   * CLIENT self-registration with optional advisor binding via partner username.
   * @param input registration payload (validated upstream)
   * @returns session DTO for the created user
   */
  async registerClient(input: RegisterClientInput): Promise<AuthSessionDto> {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new ConflictException('Email already registered');
    const advisorId = await this.resolveAdvisorId(input.ownerAdvisorUsername);
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        passwordHash: bcrypt.hashSync(input.password, 10),
        fullName: input.fullName,
        phoneEnc: input.phone ? this.piiCipher.encrypt(input.phone) : null,
        role: UserRole.CLIENT,
        advisorId,
      },
    });
    const tokens = this.tokens.signPair(claimSubset(user));
    return { user: toUserDto(user, this.piiCipher), tokens };
  }

  /**
   * Rotates the session: verifies refresh signature against the refresh secret
   * and re-derives claims from the DB row (detects suspend/delete between tokens).
   * @param refreshToken issued refresh token
   */
  async refresh(refreshToken: string): Promise<AuthSessionDto> {
    const check = this.tokens.verifyRefresh(refreshToken);
    if (!check.ok) throw new UnauthorizedException('Invalid refresh token');
    const user = await this.prisma.user.findUnique({ where: { id: check.payload.sub } });
    if (!user) throw new UnauthorizedException('User no longer exists');
    if (user.status === 'SUSPENDED') throw new ForbiddenException('Account suspended');
    if (check.payload.email !== user.email) throw new UnauthorizedException('Token drift detected');
    const tokens = this.tokens.signPair(claimSubset(user));
    return { user: toUserDto(user, this.piiCipher), tokens };
  }

  /** Resolve an optional partner username to the owned advisor user id. */
  private async resolveAdvisorId(username?: string | null): Promise<string | null> {
    if (!username) return null;
    const profile = await this.prisma.partnerProfile.findUnique({ where: { username } });
    return profile?.userId ?? null;
  }
}

/**
 * Token-claim subset from a Prisma user row (explicit map — no structural spread
 * into JWT).
 */
export function claimSubset(user: { id: string; email: string; role: string }): {
  id: string;
  email: string;
  role: string;
} {
  return { id: user.id, email: user.email, role: user.role };
}

