/**
 * Persistence helpers for the seed. Clears all tables and re-inserts the plan
 * inside a single transaction so partial failures never leave a half-seeded DB.
 */
import { Prisma, type PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { KycState, SipInstanceStatus } from '@wealthos/shared-types';
import { type SeedPlan } from './plan';

export const persistSeedPlan = {
  /** Delete every row, respecting FK order. */
  async clearAll(client: PrismaClient): Promise<void> {
    await client.$transaction([
      client.sipInstance.deleteMany(),
      client.sip.deleteMany(),
      client.commission.deleteMany(),
      client.transaction.deleteMany(),
      client.portfolio.deleteMany(),
      client.goal.deleteMany(),
      client.casUpload.deleteMany(),
      client.segment.deleteMany(),
      client.lead.deleteMany(),
      client.partnerProfile.deleteMany(),
      client.kycEvent.deleteMany(),
      client.kycRecord.deleteMany(),
      client.basketItem.deleteMany(),
      client.basket.deleteMany(),
      client.navHistory.deleteMany(),
      client.asset.deleteMany(),
      client.user.deleteMany(),
    ]);
  },

  /** Insert the full plan; returns row counts per table. */
  async persist(
    client: PrismaClient,
    plan: {
      passwordPlaintext: string;
      users: import('./plan').SeedUser[];
      assets: import('./plan').SeedAsset[];
      transactions: import('./plan').SeedTransaction[];
      sips: import('./plan').SeedSip[];
      commissions: import('./plan').SeedCommission[];
      goals: import('./plan').SeedGoal[];
      baskets: import('./plan').SeedBasket[];
      leads: import('./plan').SeedLead[];
      segments: import('./plan').SeedSegment[];
      casUploads: import('./plan').SeedCasUpload[];
      partnerProfile: import('./plan').SeedPartnerProfile;
    },
  ): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    await client.$transaction(async (tx) => {
      const passwordHash = bcrypt.hashSync(plan.passwordPlaintext, 10);
      counts.assets = await insertAssets(tx, plan.assets);
      const userIds = await insertUsers(tx, plan.users, passwordHash);
      counts.users = userIds.size;
      const partnerProfileId = await insertPartnerProfile(tx, plan.partnerProfile);
      counts.leads = await insertLeads(tx, plan.leads, partnerProfileId);
      counts.baskets = await insertBaskets(tx, plan.baskets, plan.assets);
      counts.transactions = await insertTransactions(tx, plan.transactions, userIds, plan.assets);
      counts.commissions = await insertCommissions(
        tx,
        plan.commissions,
        userIds,
        plan.assets,
        plan.transactions,
      );
      counts.sips = await insertSips(tx, plan.sips, userIds, plan.assets);
      counts.goals = await insertGoals(tx, plan.goals, userIds);
      counts.segments = await insertSegments(tx, plan.segments, userIds);
      counts.casUploads = await insertCasUploads(tx, plan.casUploads, userIds);
    });
    counts.navPoints = counts.assets === 0 ? 0 : plan.assets.reduce((sum, a) => sum + a.navHistory.length, 0);
    /* eslint-enable */
    return counts;
  },
};

type Tx = Prisma.TransactionClient;

export type { Tx };

async function insertAssets(tx: Tx, assets: import('./plan').SeedAsset[]): Promise<number> {
  for (const a of assets) {
    await tx.asset.create({
      data: {
        slug: a.slug,
        name: a.name,
        type: a.type,
        schemeCode: a.schemeCode,
        issuer: a.issuer,
        category: a.category,
        navPaise: a.navPaise,
        navUpdatedAt: (a.navHistory[a.navHistory.length - 1] as { date: Date }).date,
        navHistory: {
          create: a.navHistory.map((p) => ({ date: p.date, navPaise: p.navPaise })),
        },
      },
    });
  }
  return assets.length;
}

async function insertUsers(
  tx: Tx,
  users: import('./plan').SeedUser[],
  passwordHash: string,
): Promise<Map<string, string>> {
  const idByEmail = new Map<string, string>();
  const advisorIds = new Map<string, string>();
  for (const u of users) {
    if (u.role === 'ADVISOR') {
      const advisor = await tx.user.create({
        data: {
          email: u.email,
          passwordHash,
          fullName: u.fullName,
          phoneEnc: encryptForSeed(u.phonePlain ?? ''),
          role: 'ADVISOR',
          tier: u.tier ?? 'BRONZE',
        },
      });
      idByEmail.set(u.email, advisor.id);
      advisorIds.set(u.email, advisor.id);
    }
  }
  for (const u of users) {
    if (u.role === 'ADMIN') {
      const admin = await tx.user.create({
        data: {
          email: u.email,
          passwordHash,
          fullName: u.fullName,
          phoneEnc: encryptForSeed(u.phonePlain ?? ''),
          role: 'ADMIN',
        },
      });
      idByEmail.set(u.email, admin.id);
    }
  }
  const pendingKyc: Array<{ state: KycState; panFull: string; panMasked: string; userId: string }> = [];
  for (const u of users) {
    if (u.role !== 'CLIENT') continue;
    const advisorId = u.ownerAdvisorEmail ? (advisorIds.get(u.ownerAdvisorEmail) ?? null) : null;
    const client = await tx.user.create({
      data: {
        email: u.email,
        passwordHash,
        fullName: u.fullName,
        phoneEnc: encryptForSeed(u.phonePlain ?? ''),
        role: 'CLIENT',
        advisorId,
      },
    });
    idByEmail.set(u.email, client.id);
    if (u.kyc) {
      pendingKyc.push({
        state: u.kyc.state,
        panFull: u.kyc.panFull,
        panMasked: u.kyc.panMasked,
        userId: client.id,
      });
    }
  }
  for (const k of pendingKyc) {
    await tx.kycRecord.create({
      data: {
        userId: k.userId,
        state: k.state,
        panEnc: encryptForSeed(k.panFull),
        panMasked: k.panMasked,
        events: {
          create: {
            kind: 'STATE_TRANSITION',
            fromState: null,
            toState: k.state,
            meta: { source: 'seed' },
          },
        },
      },
    });
  }
  return idByEmail;
}

async function insertPartnerProfile(
  tx: Tx,
  profile: import('./plan').SeedPartnerProfile,
): Promise<string> {
  const owner = await tx.user.findUnique({ where: { email: profile.ownerEmail } });
  if (!owner) throw new Error(`Partner owner ${profile.ownerEmail} missing in seed`);
  const created = await tx.partnerProfile.create({
    data: {
      userId: owner.id,
      username: profile.username,
      orgName: profile.orgName,
      tagline: profile.tagline,
      bio: profile.bio,
      photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(owner.fullName)}&background=0D9488&color=fff&size=256`,
      specialties: profile.specialties,
      yearsExperience: profile.yearsExperience,
      active: true,
    },
  });
  return created.id;
}

async function insertLeads(
  tx: Tx,
  leads: import('./plan').SeedLead[],
  profileId: string,
): Promise<number> {
  for (const l of leads) {
    await tx.lead.create({
      data: {
        profileId,
        name: l.name,
        phoneEnc: encryptForSeed(l.phonePlain),
        email: l.email,
        message: l.message,
        status: l.status,
      },
    });
  }
  return leads.length;
}

async function insertBaskets(
  tx: Tx,
  baskets: import('./plan').SeedBasket[],
  assets: import('./plan').SeedAsset[],
): Promise<number> {
  const assetIdBySlug = new Map<string, string>();
  for (const a of assets) {
    const row = await tx.asset.findUnique({ where: { slug: a.slug } });
    if (row) assetIdBySlug.set(a.slug, row.id);
  }
  for (const b of baskets) {
    await tx.basket.create({
      data: {
        slug: b.slug,
        name: b.name,
        description: b.description,
        category: b.category,
        riskLevel: b.riskLevel,
        items: {
          create: b.items.map((item) => {
            const assetId = assetIdBySlug.get(item.assetSlug);
            if (!assetId) throw new Error(`Seed basket asset ${item.assetSlug} not found`);
            return { assetId, targetWeightPct: item.targetWeightPct };
          }),
        },
      },
    });
  }
  return baskets.length;
}


async function insertTransactions(
  tx: Tx,
  transactions: import('./plan').SeedTransaction[],
  userIds: Map<string, string>,
  assets: import('./plan').SeedAsset[],
): Promise<number> {
  const assetIdBySlug = new Map<string, string>();
  for (const a of assets) {
    const row = await tx.asset.findUnique({ where: { slug: a.slug } });
    if (!row) throw new Error(`Asset ${a.slug} missing`);
    assetIdBySlug.set(a.slug, row.id);
  }
  let index = 0;
  for (const t of transactions) {
    const userId = userIds.get(t.ownerEmail);
    const assetId = assetIdBySlug.get(t.assetSlug);
    if (!userId || !assetId) throw new Error(`Seed txn ${index}: user or asset missing`);
    await tx.transaction.create({
      data: {
        userId,
        assetId,
        type: t.type,
        amountPaise: t.amountPaise,
        units: t.units8,
        navPaise: t.navPaise,
        status: 'EXECUTED',
        executedAt: t.executedAt,
        createdAt: t.executedAt,
      },
    });
    index++;
  }
  await rollupHoldingsFromTransactions(tx);
  return transactions.length;
}

/** Recompute Portfolio rows from all seeded EXECUTED transactions. */
async function rollupHoldingsFromTransactions(tx: Tx): Promise<void> {
  const txns = await tx.transaction.findMany({
    where: { status: 'EXECUTED' },
    orderBy: [{ userId: 'asc' }, { executedAt: 'asc' }],
  });
  const perUserAsset = new Map<string, { userId: string; assetId: string; units: number; invested: number; realized: number; firstAt: Date }>();
  for (const t of txns) {
    const key = `${t.userId}::${t.assetId}`;
    const current = perUserAsset.get(key) ?? {
      userId: t.userId,
      assetId: t.assetId,
      units: 0,
      invested: 0,
      realized: 0,
      firstAt: t.executedAt ?? t.createdAt,
    };
    const units = Number(t.units);
    if (t.type === 'BUY' || t.type === 'SIP') {
      current.units += units;
      current.invested += t.amountPaise;
    } else {
      current.units = Math.max(0, current.units - units);
      current.realized += t.amountPaise;
    }
    perUserAsset.set(key, current);
  }
  for (const agg of perUserAsset.values()) {
    const assetNav = await tx.asset.findUnique({ where: { id: agg.assetId } });
    if (!assetNav) continue;
    if (agg.units <= 0) continue;
    const avgNavPaise = Math.round(agg.invested / agg.units);
    await tx.portfolio.create({
      data: {
        userId: agg.userId,
        assetId: agg.assetId,
        units: agg.units.toFixed(8),
        avgNavPaise,
        investedPaise: agg.invested,
        realizedPaise: agg.realized,
        firstPurchaseAt: agg.firstAt,
      },
    });
  }
}

async function insertCommissions(
  tx: Tx,
  commissions: import('./plan').SeedCommission[],
  userIds: Map<string, string>,
  assets: import('./plan').SeedAsset[],
  transactions: import('./plan').SeedTransaction[],
): Promise<number> {
  const assetIdBySlug = new Map<string, string>();
  for (const a of assets) {
    const row = await tx.asset.findUnique({ where: { slug: a.slug } });
    if (row) assetIdBySlug.set(a.slug, row.id);
  }
  let inserted = 0;
  for (const c of commissions) {
    const advisorId = userIds.get(c.advisorEmail);
    const clientId = userIds.get(c.clientEmail);
    if (!advisorId || !clientId) continue;
    let transactionId: string | null = null;
    if (c.transactionIndex !== null) {
      const t = transactions[c.transactionIndex] as import('./plan').SeedTransaction;
      const userId = userIds.get(t.ownerEmail);
      const assetId = assetIdBySlug.get(t.assetSlug);
      if (userId && assetId) {
        const found = await tx.transaction.findFirst({
          where: { userId, assetId, type: t.type, amountPaise: t.amountPaise },
        });
        transactionId = found?.id ?? null;
      }
    }
    await tx.commission.create({
      data: {
        advisorId,
        clientId,
        transactionId,
        assetType: c.assetType,
        kind: c.kind,
        rateBps: c.rateBps,
        amountPaise: c.amountPaise,
        periodKey: c.periodKey,
      },
    });
    inserted++;
  }
  return inserted;
}

async function insertSips(
  tx: Tx,
  sips: import('./plan').SeedSip[],
  userIds: Map<string, string>,
  assets: import('./plan').SeedAsset[],
): Promise<number> {
  for (const s of sips) {
    const userId = userIds.get(s.ownerEmail);
    const assetRow = await tx.asset.findUnique({ where: { slug: s.assetSlug } });
    if (!userId || !assetRow) continue;
    await tx.sip.create({
      data: {
        userId,
        assetId: assetRow.id,
        monthlyAmountPaise: s.monthlyAmountPaise,
        intervalsPerMonth: s.intervalsPerMonth,
        scheduledDays: s.scheduledDays,
        status: s.status,
        startOn: s.startOn,
        endOn: s.endOn,
        nextRunOn: s.nextRunOn,
        instances: {
          create: s.instances.map((i) => ({
            scheduledFor: i.scheduledFor,
            amountPaise: i.amountPaise,
            status: i.status,
          })),
        },
      },
    });
  }
  return sips.length;
}

async function insertGoals(
  tx: Tx,
  goals: import('./plan').SeedGoal[],
  userIds: Map<string, string>,
): Promise<number> {
  for (const g of goals) {
    const userId = userIds.get(g.ownerEmail);
    if (!userId) continue;
    await tx.goal.create({
      data: {
        userId,
        name: g.name,
        targetAmountPaise: g.targetAmountPaise,
        horizonMonths: g.horizonMonths,
        expectedAnnualReturnBps: g.expectedAnnualReturnBps,
        recommendedMonthlyPaise: g.recommendedMonthlyPaise,
        startDate: g.startDate,
      },
    });
  }
  return goals.length;
}

async function insertSegments(
  tx: Tx,
  segments: import('./plan').SeedSegment[],
  userIds: Map<string, string>,
): Promise<number> {
  for (const s of segments) {
    const ownerId = userIds.get(s.ownerEmail);
    if (!ownerId) continue;
    await tx.segment.create({
      data: { ownerId, name: s.name, description: s.description, rule: s.rule as object },
    });
  }
  return segments.length;
}

async function insertCasUploads(
  tx: Tx,
  uploads: import('./plan').SeedCasUpload[],
  userIds: Map<string, string>,
): Promise<number> {
  for (const u of uploads) {
    const userId = userIds.get(u.ownerEmail);
    if (!userId) continue;
    await tx.casUpload.create({
      data: {
        userId,
        fileName: u.fileName,
        sizeBytes: u.sizeBytes,
        parserVersion: u.parserVersion,
        status: u.status,
        transactionsImported: u.transactionsImported,
        duplicatesSkipped: u.duplicatesSkipped,
        createdAt: u.createdAt,
      },
    });
  }
  return uploads.length;
}

/**
 * Seed-only stand-in for the AES-256-GCM PII encryptor implemented in
 * apps/backend-api/infrastructure/crypto/pii-cipher.ts. It is deterministic so
 * local seeds keep stable email/phone round-trips while staying obviously not
 * plaintext.
 */
export function encryptForSeed(plain: string): string {
  return `seed:${Buffer.from(plain, 'utf8').toString('base64url')}`;
}
