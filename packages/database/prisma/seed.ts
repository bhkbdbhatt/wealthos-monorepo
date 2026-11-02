/* eslint-disable no-console */
/**
 * Deterministic seed data for WealthOS local development.
 * Run: pnpm --filter @wealthos/database db:seed
 */
import { PrismaClient } from '@prisma/client';
import { buildSeedPlan } from './plan';
import { persistSeedPlan } from './persist';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('Resetting WealthOS tables...');
  await persistSeedPlan.clearAll(prisma);
  console.log('Seeding users, assets, holdings, transactions, commissions, B2B/B2C content...');
  const plan = buildSeedPlan();
  const persisted = await persistSeedPlan.persist(prisma, plan);
  console.log(
    [
      `users=${persisted.users}`,
      `assets=${persisted.assets}`,
      `navHistory=${persisted.navPoints}`,
      `transactions=${persisted.transactions}`,
      `commissions=${persisted.commissions}`,
      `sips=${persisted.sips}`,
      `goals=${persisted.goals}`,
      `baskets=${persisted.baskets}`,
      `leads=${persisted.leads}`,
      `segments=${persisted.segments}`,
      `casUploads=${persisted.casUploads}`,
    ].join(' '),
  );
}

main()
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
