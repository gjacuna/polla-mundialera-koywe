ALTER TABLE "matches" ADD COLUMN "homePenalties" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "awayPenalties" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "externalId" integer;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_externalId_unique" UNIQUE("externalId");