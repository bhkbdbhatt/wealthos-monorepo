import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type PrismaService } from '@wealthos/database';
import { UserRole, type UserDto } from '@wealthos/shared-types';
import { type PiiCipher } from '../../core/pii-cipher';
import { toUserDto } from './users.mapper';

/**
 * Users application service. Read-mostly; registration lives in AuthService.
 */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly piiCipher: PiiCipher,
  ) {}

  /**
   * @param id Prisma user id.
   * @returns UserDto or throws NotFound.
   */
  async getUser(id: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return toUserDto(user, this.piiCipher);
  }

  /**
   * @param email unique login email.
   * @returns UserDto or throws NotFound.
   */
  async getUserByEmail(email: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundException('User not found');
    return toUserDto(user, this.piiCipher);
  }

  /**
   * Lists clients belonging to an advisor (or all clients when ADMIN).
   * @param requesterId token subject id.
   * @param requesterRole token role.
   * @returns Dtos mapped through the same mapper as self reads.
   */
  async listAdvisorClients(requesterId: string, requesterRole: UserRole): Promise<UserDto[]> {
    const where =
      requesterRole === UserRole.ADMIN
        ? { role: UserRole.CLIENT }
        : { role: UserRole.CLIENT, advisorId: requesterId };
    const users = await this.prisma.user.findMany({ where, orderBy: { createdAt: 'asc' } });
    return users.map((u) => toUserDto(u, this.piiCipher));
  }

  /**
   * Advised-client ids shortcut used by portfolio/segment scoping.
   * @param requesterId advisor id.
   * @returns List of client ids (empty for advisors with no clients).
   */
  async advisedClientIds(requesterId: string): Promise<string[]> {
    const clients = await this.prisma.user.findMany({
      where: { advisorId: requesterId },
      select: { id: true },
    });
    return clients.map((c) => c.id);
  }
}
