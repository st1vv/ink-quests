ALTER TABLE "check_ins" ADD COLUMN "tx_hash" varchar(66);--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_txHash_unique" UNIQUE("tx_hash");