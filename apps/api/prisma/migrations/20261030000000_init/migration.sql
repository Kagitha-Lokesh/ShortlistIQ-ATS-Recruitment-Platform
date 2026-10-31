-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('hr', 'candidate');

-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('pending', 'accepted', 'rejected', 'edited');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('draft', 'active', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "CandidateSource" AS ENUM ('upload', 'form');

-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('pending', 'processing', 'scored', 'failed');

-- CreateEnum
CREATE TYPE "CandidateDecision" AS ENUM ('shortlisted', 'unshortlisted', 'needs_review');

-- CreateEnum
CREATE TYPE "DecisionSource" AS ENUM ('auto', 'manual', 'knockout');

-- CreateEnum
CREATE TYPE "EmailTemplateKind" AS ENUM ('shortlisted', 'unshortlisted');

-- CreateEnum
CREATE TYPE "EmailSendStatus" AS ENUM ('queued', 'sent', 'failed', 'bounced');

-- CreateEnum
CREATE TYPE "DeletionStatus" AS ENUM ('pending', 'processing', 'completed', 'rejected');

-- CreateTable
CREATE TABLE "orgs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orgs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" TEXT NOT NULL,
    "org_id" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'candidate',
    "full_name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_checks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "anon_token" TEXT,
    "job_title" TEXT NOT NULL,
    "company" TEXT,
    "jd_text" TEXT NOT NULL,
    "resume_text" TEXT,
    "resume_path" TEXT,
    "score_before" INTEGER,
    "score_after" INTEGER,
    "breakdown" JSONB,
    "status" "CheckStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggestions" (
    "id" TEXT NOT NULL,
    "check_id" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "original_text" TEXT NOT NULL,
    "proposed_text" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "impact" TEXT,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'pending',
    "final_text" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "batches" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "jd_text" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "cutoff" INTEGER NOT NULL DEFAULT 70,
    "status" "BatchStatus" NOT NULL DEFAULT 'draft',
    "finalized_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "forms" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "schema" JSONB NOT NULL,
    "knockout_rules" JSONB,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "forms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "source" "CandidateSource" NOT NULL DEFAULT 'upload',
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "resume_path" TEXT,
    "resume_text" TEXT,
    "form_answers" JSONB,
    "score" INTEGER,
    "breakdown" JSONB,
    "criteria_results" JSONB,
    "ai_summary" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'pending',
    "decision" "CandidateDecision",
    "decision_source" "DecisionSource",
    "failure_reason" TEXT,
    "dedupe_key" TEXT,
    "consent_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_accounts" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "encrypted_refresh_token" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "kind" "EmailTemplateKind" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sends" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "status" "EmailSendStatus" NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "sent_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_sends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deletion_requests" (
    "id" TEXT NOT NULL,
    "email_hash" TEXT NOT NULL,
    "status" "DeletionStatus" NOT NULL DEFAULT 'pending',
    "verified_at" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "llm_caches" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_caches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "profiles_org_id_idx" ON "profiles"("org_id");

-- CreateIndex
CREATE INDEX "candidate_checks_user_id_idx" ON "candidate_checks"("user_id");

-- CreateIndex
CREATE INDEX "candidate_checks_anon_token_idx" ON "candidate_checks"("anon_token");

-- CreateIndex
CREATE INDEX "candidate_checks_status_idx" ON "candidate_checks"("status");

-- CreateIndex
CREATE INDEX "candidate_checks_expires_at_idx" ON "candidate_checks"("expires_at");

-- CreateIndex
CREATE INDEX "suggestions_check_id_idx" ON "suggestions"("check_id");

-- CreateIndex
CREATE INDEX "suggestions_status_idx" ON "suggestions"("status");

-- CreateIndex
CREATE INDEX "batches_org_id_idx" ON "batches"("org_id");

-- CreateIndex
CREATE INDEX "batches_status_idx" ON "batches"("status");

-- CreateIndex
CREATE UNIQUE INDEX "forms_slug_key" ON "forms"("slug");

-- CreateIndex
CREATE INDEX "forms_org_id_idx" ON "forms"("org_id");

-- CreateIndex
CREATE INDEX "forms_batch_id_idx" ON "forms"("batch_id");

-- CreateIndex
CREATE INDEX "candidates_batch_id_idx" ON "candidates"("batch_id");

-- CreateIndex
CREATE INDEX "candidates_status_idx" ON "candidates"("status");

-- CreateIndex
CREATE INDEX "candidates_decision_idx" ON "candidates"("decision");

-- CreateIndex
CREATE INDEX "candidates_score_idx" ON "candidates"("score");

-- CreateIndex
CREATE INDEX "candidates_dedupe_key_idx" ON "candidates"("dedupe_key");

-- CreateIndex
CREATE INDEX "candidates_expires_at_idx" ON "candidates"("expires_at");

-- CreateIndex
CREATE INDEX "email_accounts_owner_id_idx" ON "email_accounts"("owner_id");

-- CreateIndex
CREATE INDEX "email_templates_batch_id_idx" ON "email_templates"("batch_id");

-- CreateIndex
CREATE INDEX "email_sends_batch_id_idx" ON "email_sends"("batch_id");

-- CreateIndex
CREATE INDEX "email_sends_candidate_id_idx" ON "email_sends"("candidate_id");

-- CreateIndex
CREATE INDEX "email_sends_status_idx" ON "email_sends"("status");

-- CreateIndex
CREATE UNIQUE INDEX "email_sends_batch_id_candidate_id_key" ON "email_sends"("batch_id", "candidate_id");

-- CreateIndex
CREATE UNIQUE INDEX "deletion_requests_email_hash_key" ON "deletion_requests"("email_hash");

-- CreateIndex
CREATE INDEX "deletion_requests_status_idx" ON "deletion_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "llm_caches_key_key" ON "llm_caches"("key");

-- CreateIndex
CREATE INDEX "llm_caches_key_idx" ON "llm_caches"("key");

-- CreateIndex
CREATE INDEX "audit_logs_org_id_idx" ON "audit_logs"("org_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_checks" ADD CONSTRAINT "candidate_checks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_check_id_fkey" FOREIGN KEY ("check_id") REFERENCES "candidate_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "batches" ADD CONSTRAINT "batches_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "forms" ADD CONSTRAINT "forms_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_accounts" ADD CONSTRAINT "email_accounts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

