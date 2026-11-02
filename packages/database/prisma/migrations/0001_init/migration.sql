-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ADVISOR', 'CLIENT');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "AdvisorTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('MUTUAL_FUND', 'EQUITY', 'BOND', 'FIXED_DEPOSIT', 'INSURANCE');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL', 'SIP', 'SWITCH');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'EXECUTED', 'FAILED');

-- CreateEnum
CREATE TYPE "KycState" AS ENUM ('INITIATED', 'PAN_VALIDATED', 'DIGILOCKER_SYNCED', 'AADHAAR_ESIGNED', 'VIDEO_KYC_PENDING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "KycEventKind" AS ENUM ('STATE_TRANSITION', 'ADAPTER_CALLBACK');

-- CreateEnum
CREATE TYPE "CommissionKind" AS ENUM ('UPFRONT', 'TRAIL');

-- CreateEnum
CREATE TYPE "SipStatus" AS ENUM ('ACTIVE', 'PAUSED', 'CANCELLED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "SipInstanceStatus" AS ENUM ('SCHEDULED', 'EXECUTED', 'FAILED', 'MISSED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "CasUploadStatus" AS ENUM ('PROCESSING', 'SUCCESS', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "BasketRisk" AS ENUM ('LOW', 'MODERATE', 'HIGH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phoneEnc" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CLIENT',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "tier" "AdvisorTier" NOT NULL DEFAULT 'BRONZE',
    "advisorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "tagline" TEXT,
    "bio" TEXT,
    "photoUrl" TEXT,
    "website" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "yearsExperience" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneEnc" TEXT NOT NULL,
    "email" TEXT,
    "message" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" "KycState" NOT NULL DEFAULT 'INITIATED',
    "panEnc" TEXT,
    "panMasked" TEXT,
    "digilockerDocId" TEXT,
    "aadhaarEsignRef" TEXT,
    "videoKycRef" TEXT,
    "videoKycScheduledAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KycRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KycEvent" (
    "id" TEXT NOT NULL,
    "kycId" TEXT NOT NULL,
    "kind" "KycEventKind" NOT NULL DEFAULT 'STATE_TRANSITION',
    "fromState" TEXT,
    "toState" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "schemeCode" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "category" TEXT,
    "navPaise" INTEGER NOT NULL,
    "navUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NavHistory" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "navPaise" INTEGER NOT NULL,

    CONSTRAINT "NavHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Portfolio" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "units" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "avgNavPaise" INTEGER NOT NULL DEFAULT 0,
    "investedPaise" INTEGER NOT NULL DEFAULT 0,
    "realizedPaise" INTEGER NOT NULL DEFAULT 0,
    "firstPurchaseAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Portfolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "units" DECIMAL(24,8) NOT NULL,
    "navPaise" INTEGER NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'EXECUTED',
    "idempotencyKey" TEXT,
    "executedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "monthlyAmountPaise" INTEGER NOT NULL,
    "intervalsPerMonth" INTEGER NOT NULL DEFAULT 1,
    "scheduledDays" INTEGER[],
    "status" "SipStatus" NOT NULL DEFAULT 'ACTIVE',
    "startOn" DATE NOT NULL,
    "endOn" DATE,
    "nextRunOn" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SipInstance" (
    "id" TEXT NOT NULL,
    "sipId" TEXT NOT NULL,
    "scheduledFor" DATE NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "status" "SipInstanceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "transactionId" TEXT,

    CONSTRAINT "SipInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Commission" (
    "id" TEXT NOT NULL,
    "advisorId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "transactionId" TEXT,
    "assetType" "AssetType" NOT NULL,
    "kind" "CommissionKind" NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "periodKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmountPaise" INTEGER NOT NULL,
    "horizonMonths" INTEGER NOT NULL,
    "expectedAnnualReturnBps" INTEGER NOT NULL,
    "recommendedMonthlyPaise" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Basket" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "riskLevel" "BasketRisk" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Basket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BasketItem" (
    "id" TEXT NOT NULL,
    "basketId" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "targetWeightPct" INTEGER NOT NULL,

    CONSTRAINT "BasketItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Segment" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rule" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Segment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasUpload" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "parserVersion" TEXT NOT NULL,
    "status" "CasUploadStatus" NOT NULL DEFAULT 'PROCESSING',
    "transactionsImported" INTEGER NOT NULL DEFAULT 0,
    "duplicatesSkipped" INTEGER NOT NULL DEFAULT 0,
    "errorDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CasUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_advisorId_idx" ON "User"("advisorId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_userId_key" ON "PartnerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerProfile_username_key" ON "PartnerProfile"("username");

-- CreateIndex
CREATE INDEX "Lead_profileId_status_idx" ON "Lead"("profileId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "KycRecord_userId_key" ON "KycRecord"("userId");

-- CreateIndex
CREATE INDEX "KycEvent_kycId_idx" ON "KycEvent"("kycId");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_slug_key" ON "Asset"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_schemeCode_key" ON "Asset"("schemeCode");

-- CreateIndex
CREATE INDEX "NavHistory_assetId_date_idx" ON "NavHistory"("assetId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "NavHistory_assetId_date_key" ON "NavHistory"("assetId", "date");

-- CreateIndex
CREATE INDEX "Portfolio_userId_idx" ON "Portfolio"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Portfolio_userId_assetId_key" ON "Portfolio"("userId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_idempotencyKey_key" ON "Transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_assetId_idx" ON "Transaction"("assetId");

-- CreateIndex
CREATE INDEX "Sip_userId_idx" ON "Sip"("userId");

-- CreateIndex
CREATE INDEX "Sip_status_nextRunOn_idx" ON "Sip"("status", "nextRunOn");

-- CreateIndex
CREATE UNIQUE INDEX "SipInstance_transactionId_key" ON "SipInstance"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "SipInstance_sipId_scheduledFor_key" ON "SipInstance"("sipId", "scheduledFor");

-- CreateIndex
CREATE INDEX "Commission_advisorId_createdAt_idx" ON "Commission"("advisorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Commission_advisorId_periodKey_key" ON "Commission"("advisorId", "periodKey");

-- CreateIndex
CREATE INDEX "Goal_userId_idx" ON "Goal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Basket_slug_key" ON "Basket"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "BasketItem_basketId_assetId_key" ON "BasketItem"("basketId", "assetId");

-- CreateIndex
CREATE INDEX "Segment_ownerId_idx" ON "Segment"("ownerId");

-- CreateIndex
CREATE INDEX "CasUpload_userId_idx" ON "CasUpload"("userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerProfile" ADD CONSTRAINT "PartnerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PartnerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycRecord" ADD CONSTRAINT "KycRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KycEvent" ADD CONSTRAINT "KycEvent_kycId_fkey" FOREIGN KEY ("kycId") REFERENCES "KycRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NavHistory" ADD CONSTRAINT "NavHistory_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Portfolio" ADD CONSTRAINT "Portfolio_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sip" ADD CONSTRAINT "Sip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sip" ADD CONSTRAINT "Sip_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SipInstance" ADD CONSTRAINT "SipInstance_sipId_fkey" FOREIGN KEY ("sipId") REFERENCES "Sip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SipInstance" ADD CONSTRAINT "SipInstance_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_advisorId_fkey" FOREIGN KEY ("advisorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BasketItem" ADD CONSTRAINT "BasketItem_basketId_fkey" FOREIGN KEY ("basketId") REFERENCES "Basket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BasketItem" ADD CONSTRAINT "BasketItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Segment" ADD CONSTRAINT "Segment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasUpload" ADD CONSTRAINT "CasUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

