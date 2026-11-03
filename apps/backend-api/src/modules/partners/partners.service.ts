import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type PrismaService } from '@wealthos/database';
import {
  LeadStatus,
  UserRole,
  type LeadDto,
  type PartnerDto,
} from '@wealthos/shared-types';
import { JOB_QUEUE_TOKEN } from '../../core/queue/queue.providers';
import { QUEUE_NAMES, type JobQueuePort } from '../../core/queue/queue.port';
import { type PiiCipher } from '../../core/pii-cipher';
import { type CaptureLeadDto, type UpsertPartnerProfileDto } from './partners.dto';

interface ProfileRow {
  id: string;
  userId: string;
  username: string;
  orgName: string;
  tagline: string | null;
  bio: string | null;
  photoUrl: string | null;
  website: string | null;
  specialties: string[];
  yearsExperience: number;
  active: boolean;
  user?: { email: string; phoneEnc: string | null };
}

/**
 * B2B partner desk (Module B3): white-label landing page profile, public lead
 * capture, and the advisor's lead inbox. Lead phone numbers are AES-256-GCM
 * encrypted at rest and only decrypted for the owning advisor.
 */
@Injectable()
export class PartnersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly piiCipher: PiiCipher,
    @Inject(JOB_QUEUE_TOKEN) private readonly queue: JobQueuePort,
  ) {}

  /**
   * @param username public partner slug
   * @returns public landing page profile (contact PII omitted)
   */
  async getPublicProfile(username: string): Promise<PartnerDto> {
    const profile = await this.prisma.partnerProfile.findUnique({
      where: { username },
      include: { user: { select: { email: true, phoneEnc: true } } },
    });
    if (!profile || !profile.active) throw new NotFoundException('Partner page not found');
    return this.toDto(profile, { includeContact: false });
  }

  /** @param me advisor principal @returns own editable profile. */
  async getMyProfile(me: { id: string; role: UserRole }): Promise<PartnerDto> {
    this.assertAdvisor(me);
    const profile = await this.prisma.partnerProfile.findUnique({
      where: { userId: me.id },
      include: { user: { select: { email: true, phoneEnc: true } } },
    });
    if (!profile) throw new NotFoundException('Partner profile has not been created yet');
    return this.toDto(profile, { includeContact: true });
  }

  /**
   * @param me advisor principal
   * @param input profile fields; username is required on first save
   */
  async upsertMyProfile(
    me: { id: string; role: UserRole },
    input: UpsertPartnerProfileDto,
  ): Promise<PartnerDto> {
    this.assertAdvisor(me);
    const existing = await this.prisma.partnerProfile.findUnique({ where: { userId: me.id } });
    if (!existing) {
      if (!input.username) throw new ConflictException('username is required to create a profile');
      const usernameTaken = await this.prisma.partnerProfile.findUnique({
        where: { username: input.username },
      });
      if (usernameTaken) throw new ConflictException('That username is already taken');
    }
    if (input.username && existing && input.username !== existing.username) {
      const usernameTaken = await this.prisma.partnerProfile.findUnique({
        where: { username: input.username },
      });
      if (usernameTaken) throw new ConflictException('That username is already taken');
    }
    const profile = await this.prisma.partnerProfile.upsert({
      where: { userId: me.id },
      create: {
        userId: me.id,
        username: input.username as string,
        orgName: input.orgName,
        tagline: input.tagline ?? null,
        bio: input.bio ?? null,
        photoUrl: input.photoUrl ?? null,
        website: input.website ?? null,
        specialties: input.specialties ?? [],
        yearsExperience: input.yearsExperience ?? 0,
        active: input.active ?? true,
      },
      update: {
        username: input.username ?? undefined,
        orgName: input.orgName,
        tagline: input.tagline ?? undefined,
        bio: input.bio ?? undefined,
        photoUrl: input.photoUrl ?? undefined,
        website: input.website ?? undefined,
        specialties: input.specialties ?? undefined,
        yearsExperience: input.yearsExperience ?? undefined,
        active: input.active ?? undefined,
      },
      include: { user: { select: { email: true, phoneEnc: true } } },
    });
    if (input.phone !== undefined) {
      await this.prisma.user.update({
        where: { id: me.id },
        data: { phoneEnc: input.phone ? this.piiCipher.encrypt(input.phone) : null },
      });
      profile.user.phoneEnc = input.phone ? this.piiCipher.encrypt(input.phone) : null;
    }
    return this.toDto(profile, { includeContact: true });
  }

  /**
   * Public lead capture; never returns the lead's PII.
   * @param username partner slug
   * @param input lead form
   */
  async captureLead(username: string, input: CaptureLeadDto): Promise<{ received: true }> {
    const profile = await this.prisma.partnerProfile.findUnique({ where: { username } });
    if (!profile || !profile.active) throw new NotFoundException('Partner page not found');
    const lead = await this.prisma.lead.create({
      data: {
        profileId: profile.id,
        name: input.name,
        phoneEnc: this.piiCipher.encrypt(input.phone),
        email: input.email ?? null,
        message: input.message ?? null,
        status: LeadStatus.NEW,
      },
    });
    await this.queue.enqueue(QUEUE_NAMES.LEAD_NOTIFICATION, {
      leadId: lead.id,
      partnerUserId: profile.userId,
      profileUsername: profile.username,
    });
    return { received: true };
  }

  /**
   * @param me advisor principal
   * @param status optional lead-status filter
   */
  async listLeads(me: { id: string; role: UserRole }, status?: LeadStatus): Promise<LeadDto[]> {
    this.assertAdvisor(me);
    const profile = await this.prisma.partnerProfile.findUnique({ where: { userId: me.id } });
    if (!profile) return [];
    const leads = await this.prisma.lead.findMany({
      where: { profileId: profile.id, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
    return leads.map((lead) => this.toLeadDto(lead));
  }

  /**
   * @param me advisor principal
   * @param leadId target lead
   * @param status next lead status
   */
  async updateLeadStatus(
    me: { id: string; role: UserRole },
    leadId: string,
    status: LeadStatus,
  ): Promise<LeadDto> {
    this.assertAdvisor(me);
    const profile = await this.prisma.partnerProfile.findUnique({ where: { userId: me.id } });
    if (!profile) throw new NotFoundException('Partner profile not found');
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead || lead.profileId !== profile.id) throw new NotFoundException('Lead not found');
    const updated = await this.prisma.lead.update({ where: { id: lead.id }, data: { status } });
    return this.toLeadDto(updated);
  }

  /** Admin directory of all partner profiles. */
  async listAll(me: { id: string; role: UserRole }): Promise<PartnerDto[]> {
    if (me.role !== UserRole.ADMIN) throw new ForbiddenException('Admin only');
    const profiles = await this.prisma.partnerProfile.findMany({
      include: { user: { select: { email: true, phoneEnc: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return profiles.map((profile) => this.toDto(profile, { includeContact: true }));
  }

  private assertAdvisor(me: { role: UserRole }): void {
    if (me.role !== UserRole.ADVISOR && me.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Partner desk is available to advisors only');
    }
  }

  private toDto(profile: ProfileRow, options: { includeContact: boolean }): PartnerDto {
    return {
      id: profile.id,
      username: profile.username,
      orgName: profile.orgName,
      tagline: profile.tagline,
      bio: profile.bio,
      photoUrl: profile.photoUrl,
      phone: options.includeContact && profile.user
        ? this.piiCipher.decrypt(profile.user.phoneEnc ?? '')
        : null,
      email: options.includeContact ? (profile.user?.email ?? null) : null,
      website: profile.website,
      specialties: [...profile.specialties],
      yearsExperience: profile.yearsExperience,
      active: profile.active,
    };
  }

  private toLeadDto(lead: {
    id: string;
    profileId: string;
    name: string;
    phoneEnc: string;
    email: string | null;
    message: string | null;
    status: string;
    createdAt: Date;
  }): LeadDto {
    return {
      id: lead.id,
      partnerId: lead.profileId,
      name: lead.name,
      phone: this.piiCipher.decrypt(lead.phoneEnc),
      email: lead.email,
      message: lead.message,
      status: lead.status as LeadStatus,
      createdAt: lead.createdAt.toISOString(),
    };
  }
}
