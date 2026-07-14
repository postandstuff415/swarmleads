-- CreateEnum
CREATE TYPE "ScrapeJobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "ScrapeStage" AS ENUM ('scraper', 'strategist', 'writer', 'done');

-- CreateEnum
CREATE TYPE "OutreachStatus" AS ENUM ('queued', 'pushed', 'failed');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "scrape_job_id" TEXT,
ADD COLUMN     "user_id" TEXT;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_jobs" (
    "id" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "status" "ScrapeJobStatus" NOT NULL DEFAULT 'queued',
    "stage" "ScrapeStage" NOT NULL DEFAULT 'scraper',
    "leads_found" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "outscraper_units" INTEGER,
    "outscraper_cost" DECIMAL(10,4),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),
    "user_id" TEXT,

    CONSTRAINT "scrape_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outreach_queue" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "status" "OutreachStatus" NOT NULL DEFAULT 'queued',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outreach_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bounceback_links" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "bounceback_account_email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'linked',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bounceback_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "scrape_jobs_status_idx" ON "scrape_jobs"("status");

-- CreateIndex
CREATE INDEX "scrape_jobs_created_at_idx" ON "scrape_jobs"("created_at");

-- CreateIndex
CREATE INDEX "outreach_queue_status_idx" ON "outreach_queue"("status");

-- CreateIndex
CREATE INDEX "bounceback_links_lead_id_idx" ON "bounceback_links"("lead_id");

-- CreateIndex
CREATE INDEX "leads_scrape_job_id_idx" ON "leads"("scrape_job_id");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_scrape_job_id_fkey" FOREIGN KEY ("scrape_job_id") REFERENCES "scrape_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrape_jobs" ADD CONSTRAINT "scrape_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outreach_queue" ADD CONSTRAINT "outreach_queue_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bounceback_links" ADD CONSTRAINT "bounceback_links_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
