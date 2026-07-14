-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'verified', 'high_intent');

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "contact_person" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "industry" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "angle" TEXT,
    "source" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "outreach_script" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bounceback_logs" (
    "id" TEXT NOT NULL,
    "incoming_number" TEXT,
    "outgoing_text" TEXT,
    "industry" TEXT,
    "region" TEXT,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bounceback_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE INDEX "bounceback_logs_created_at_idx" ON "bounceback_logs"("created_at");
