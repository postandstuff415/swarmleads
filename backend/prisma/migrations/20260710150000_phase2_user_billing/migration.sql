-- AlterTable
ALTER TABLE "users" ADD COLUMN     "stripe_customer_id" TEXT,
ADD COLUMN     "subscription_since" TIMESTAMP(3),
ADD COLUMN     "subscription_status" TEXT NOT NULL DEFAULT 'inactive';

-- CreateIndex
CREATE UNIQUE INDEX "users_stripe_customer_id_key" ON "users"("stripe_customer_id");

