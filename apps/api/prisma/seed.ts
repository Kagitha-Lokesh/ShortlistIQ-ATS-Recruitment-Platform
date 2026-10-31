import {
  orgRepository,
  profileRepository,
  getBatchRepository,
  getCandidateRepository,
  getFormRepository,
  getEmailAccountRepository,
  candidateCheckRepository,
  resetRepositories
} from '../src/repositories/index.js';
import { encryptToken } from '../src/services/crypto.js';
import { BatchStatus, CandidateStatus, CandidateDecision } from '@prisma/client';

export async function runSeed() {
  resetRepositories();

  // Org A: Apex Innovations
  const orgA = await orgRepository.create('Apex Innovations Inc.');
  const hrA = await profileRepository.create({
    id: 'user-apex-alice',
    orgId: orgA.id,
    role: 'hr',
    fullName: 'Alice HR Director'
  });

  const batchRepoA = getBatchRepository(orgA.id);
  const batchA = await batchRepoA.create({
    name: 'Senior Full Stack Engineer Q4',
    jobTitle: 'Senior Full Stack Engineer',
    jdText: 'Looking for a Senior Full Stack Engineer with 4+ years of React, TypeScript, and Node.js experience.',
    criteria: {
      requiredKeywords: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
      minimumYearsExperience: 4
    },
    cutoff: 75,
    ownerId: hrA.id,
    status: BatchStatus.active
  });

  const candidateRepoA = getCandidateRepository(orgA.id);
  const candidateA = await candidateRepoA.create({
    batchId: batchA.id,
    fullName: 'Alex Mercer',
    email: 'alex.mercer@testmail.com',
    phone: '+1 555-0100',
    resumeText: 'Experienced developer with 5 years in TypeScript, React, and Node.js.'
  });

  await candidateRepoA.update(candidateA.id, {
    score: 85,
    status: CandidateStatus.scored,
    decision: CandidateDecision.shortlisted
  });

  const formRepoA = getFormRepository(orgA.id);
  await formRepoA.create({
    batchId: batchA.id,
    slug: 'apex-fullstack',
    title: 'Apply - Senior Full Stack Engineer',
    schema: { questions: [{ id: 'q1', text: 'Years of React experience?' }] },
    isPublished: true
  });

  const emailRepoA = getEmailAccountRepository(orgA.id, hrA.id);
  await emailRepoA.create({
    provider: 'gmail',
    address: 'careers@apex.com',
    encryptedRefreshToken: encryptToken('mock-refresh-token-apex-123'),
    scopes: 'https://mail.google.com/'
  });

  // Org B: Beacon Technologies
  const orgB = await orgRepository.create('Beacon Technologies');
  const hrB = await profileRepository.create({
    id: 'user-beacon-bob',
    orgId: orgB.id,
    role: 'hr',
    fullName: 'Bob Talent Lead'
  });

  const batchRepoB = getBatchRepository(orgB.id);
  const batchB = await batchRepoB.create({
    name: 'Staff DevOps Engineer 2026',
    jobTitle: 'Staff DevOps Engineer',
    jdText: 'Seeking DevOps specialist with deep Kubernetes, Terraform, and AWS background.',
    criteria: {
      requiredKeywords: ['Kubernetes', 'Terraform', 'AWS', 'CI/CD'],
      minimumYearsExperience: 6
    },
    cutoff: 80,
    ownerId: hrB.id,
    status: BatchStatus.active
  });

  const candidateRepoB = getCandidateRepository(orgB.id);
  const candidateB = await candidateRepoB.create({
    batchId: batchB.id,
    fullName: 'Brianna Diaz',
    email: 'brianna.diaz@testmail.com',
    phone: '+1 555-0200',
    resumeText: 'DevOps lead with 7 years administering Kubernetes clusters on AWS.'
  });

  await candidateRepoB.update(candidateB.id, {
    score: 92,
    status: CandidateStatus.scored,
    decision: CandidateDecision.shortlisted
  });

  const formRepoB = getFormRepository(orgB.id);
  await formRepoB.create({
    batchId: batchB.id,
    slug: 'beacon-devops',
    title: 'Apply - Staff DevOps Engineer',
    schema: { questions: [{ id: 'q1', text: 'Kubernetes cluster experience?' }] },
    isPublished: true
  });

  const emailRepoB = getEmailAccountRepository(orgB.id, hrB.id);
  await emailRepoB.create({
    provider: 'outlook',
    address: 'talent@beacon.com',
    encryptedRefreshToken: encryptToken('mock-refresh-token-beacon-456'),
    scopes: 'Mail.Send'
  });

  // Guest candidate checks
  const check1 = await candidateCheckRepository.create({
    anonToken: 'anon-token-11111',
    jobTitle: 'Frontend Lead',
    company: 'MetaCorp',
    jdText: 'Frontend Lead needed with 5+ years React.'
  });

  const check2 = await candidateCheckRepository.create({
    anonToken: 'anon-token-22222',
    jobTitle: 'Data Scientist',
    company: 'DataLabs',
    jdText: 'Data Scientist needed with Python and SQL.'
  });

  return {
    orgA,
    hrA,
    batchA,
    candidateA,
    orgB,
    hrB,
    batchB,
    candidateB,
    check1,
    check2
  };
}

// Self-invoking when run via tsx
if (import.meta.url.endsWith(process.argv[1] || '')) {
  runSeed().then(() => {
    console.log('Seed completed successfully with 2 Orgs, sample batches, candidates, forms, email accounts, and guest checks.');
  });
}

