/**
 * ShortlistIQ Automated Smoke Test Script
 * Exercises core platform milestones:
 * 1. Health & Readiness probes (/health, /ready)
 * 2. HR User Registration & Tenancy Auth (/api/v1/auth/signup-hr, /api/v1/auth/me)
 * 3. Candidate Resume ATS Check (/api/v1/checks)
 * 4. HR Batch Creation & Candidate Upload (/api/v1/batches, /api/v1/batches/:id/candidates)
 * 5. Criteria Synthesis & Shortlisting Re-score (/api/v1/batches/:id/criteria)
 * 6. Personalized Email Test Preview (/api/v1/email/batches/:id/test)
 *
 * Can run locally or against a deployed staging/production environment:
 *   API_URL=https://api.shortlistiq.com tsx scripts/smoke-test.ts
 */

const BASE_URL = process.env.API_URL || process.env.SMOKE_TEST_URL || 'http://localhost:4000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function logStep(stepNum: number, name: string) {
  console.log(`\n${colors.cyan}${colors.bold}[Step ${stepNum}] ${name}${colors.reset}`);
}

function logSuccess(msg: string) {
  console.log(`  ${colors.green}✓ ${msg}${colors.reset}`);
}

function logError(msg: string) {
  console.error(`  ${colors.red}✗ ${msg}${colors.reset}`);
}

async function runSmokeTest() {
  console.log(`${colors.bold}======================================================${colors.reset}`);
  console.log(`${colors.bold}   ShortlistIQ ATS Recruitment Platform Smoke Test    ${colors.reset}`);
  console.log(`   Target Endpoint: ${colors.yellow}${BASE_URL}${colors.reset}`);
  console.log(`${colors.bold}======================================================${colors.reset}`);

  const timestamp = Date.now();
  let authToken = '';
  let orgId = '';
  let batchId = '';
  let checkId = '';

  try {
    // ---------------------------------------------------------
    // Step 1: Health & Readiness Endpoints
    // ---------------------------------------------------------
    logStep(1, 'Testing Liveness & Readiness Probes');
    const healthRes = await fetch(`${BASE_URL}/health`);
    if (!healthRes.ok) throw new Error(`Health check failed with HTTP ${healthRes.status}`);
    const healthJson = (await healthRes.json()) as any;
    if (healthJson.status !== 'ok') throw new Error(`Unexpected health payload: ${JSON.stringify(healthJson)}`);
    logSuccess(`Liveness probe healthy (/health, service: ${healthJson.service})`);

    const readyRes = await fetch(`${BASE_URL}/ready`);
    if (!readyRes.ok) throw new Error(`Readiness check failed with HTTP ${readyRes.status}`);
    const readyJson = (await readyRes.json()) as any;
    if (readyJson.status !== 'ready') throw new Error(`Readiness probe failed: ${JSON.stringify(readyJson)}`);
    logSuccess(`Readiness probe healthy (/ready, database: ${readyJson.components?.database}, storage: ${readyJson.components?.storage})`);

    // ---------------------------------------------------------
    // Step 2: HR Signup & Authentication
    // ---------------------------------------------------------
    logStep(2, 'Exercising HR Sign-Up & Tenancy Auth');
    const hrEmail = `smoke-hr-${timestamp}@apexrecruitment.test`;
    const signupRes = await fetch(`${BASE_URL}/api/v1/auth/signup-hr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: hrEmail,
        password: 'SecurePassword123!',
        fullName: 'Smoke Test Admin',
        organizationName: `Apex Innovations ${timestamp}`
      })
    });

    if (!signupRes.ok) {
      const errText = await signupRes.text();
      throw new Error(`HR Sign-up failed (${signupRes.status}): ${errText}`);
    }

    const signupData = (await signupRes.json()) as any;
    authToken = signupData.data?.token || signupData.token;
    orgId = signupData.data?.profile?.orgId || signupData.profile?.orgId;
    logSuccess(`HR Profile created (ID: ${signupData.profile?.id}, Org: ${signupData.organization?.name})`);

    // Verify /api/v1/auth/me
    const meRes = await fetch(`${BASE_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    if (!meRes.ok) throw new Error(`Auth verification failed (${meRes.status})`);
    const meData = (await meRes.json()) as any;
    const meProfile = meData.data?.profile || meData.profile;
    logSuccess(`Session authenticated via Bearer token (User: ${meProfile?.fullName}, Role: ${meProfile?.role})`);

    // ---------------------------------------------------------
    // Step 3: Candidate Resume Check
    // ---------------------------------------------------------
    logStep(3, 'Exercising Candidate ATS Resume Check');
    const resumePdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Title (Smoke Test Resume) >>\nendobj\n2 0 obj\n<< /Length 120 >>\nstream\n' +
        'BT /F1 12 Tf 72 712 Td (John Doe Engineering Resume) Tj ET\n' +
        'BT /F1 12 Tf 72 690 Td (Email: john.doe@example.com Phone: 555-0199) Tj ET\n' +
        'BT /F1 12 Tf 72 670 Td (Technical Skills: React, TypeScript, Node.js, PostgreSQL, Docker, AWS) Tj ET\n' +
        'BT /F1 12 Tf 72 650 Td (Experience: 5 years building scalable web architectures and REST APIs) Tj ET\n' +
        'endstream\nendobj\nxref\n0 3\n0000000000 65535 f\n0000000010 00000 n\n0000000070 00000 n\ntrailer\n<< /Size 3 >>\nstartxref\n250\n%%EOF'
    );

    const formData = new FormData();
    const blob = new Blob([resumePdfBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'smoke_resume.pdf');
    formData.append('jobTitle', 'Senior Full Stack Engineer');
    formData.append('company', 'Apex Innovations');
    formData.append(
      'jdText',
      'We are looking for a Senior Full Stack Engineer with 4+ years building distributed React, TypeScript, Node.js, and PostgreSQL cloud applications. Docker experience is preferred.'
    );

    const checkRes = await fetch(`${BASE_URL}/api/v1/checks`, {
      method: 'POST',
      body: formData
    });

    if (!checkRes.ok) {
      const errText = await checkRes.text();
      throw new Error(`Resume check failed (${checkRes.status}): ${errText}`);
    }

    const checkData = (await checkRes.json()) as any;
    checkId = checkData.data?.id;
    const score = checkData.data?.scoreBefore;
    logSuccess(`Resume parsed and scored (Score: ${score}/100, Check ID: ${checkId})`);
    logSuccess(
      `Breakdown: Keywords=${checkData.data?.breakdown?.keywordScore}/50, Experience=${checkData.data?.breakdown?.experienceScore}/25, Format=${checkData.data?.breakdown?.formattingScore}/10`
    );

    // ---------------------------------------------------------
    // Step 4: HR Batch Creation & Candidate Upload
    // ---------------------------------------------------------
    logStep(4, 'Exercising HR Batch Creation & Candidate Bulk Upload');
    const batchRes = await fetch(`${BASE_URL}/api/v1/batches`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        name: `Engineering Cohort ${timestamp}`,
        jobTitle: 'Senior Full Stack Engineer',
        jdText:
          'We require 4+ years experience with React, TypeScript, Node.js, and PostgreSQL. Experience deploying cloud microservices is required.',
        cutoff: 75
      })
    });

    if (!batchRes.ok) {
      const errText = await batchRes.text();
      throw new Error(`Batch creation failed (${batchRes.status}): ${errText}`);
    }

    const batchData = (await batchRes.json()) as any;
    batchId = batchData.data?.id;
    logSuccess(`Batch created (Batch ID: ${batchId}, Title: ${batchData.data?.jobTitle}, Cutoff: ${batchData.data?.cutoff})`);

    // Upload candidate to batch
    const uploadFormData = new FormData();
    uploadFormData.append('files', blob, 'candidate_alice.pdf');

    const uploadRes = await fetch(`${BASE_URL}/api/v1/batches/${batchId}/candidates/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authToken}` },
      body: uploadFormData
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      throw new Error(`Batch upload failed (${uploadRes.status}): ${errText}`);
    }

    const uploadResult = (await uploadRes.json()) as any;
    logSuccess(`Candidate uploaded to batch (Uploaded: ${uploadResult.uploadedCount}, Enqueued: ${uploadResult.enqueuedCount})`);

    // ---------------------------------------------------------
    // Step 5: Criteria Shortlisting & Cutoff Re-score
    // ---------------------------------------------------------
    logStep(5, 'Exercising Shortlisting Criteria & Re-score Run');
    const criteriaRes = await fetch(`${BASE_URL}/api/v1/batches/${batchId}/criteria`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        cutoff: 75,
        alwaysRequireAllMustHaves: true,
        criteria: [
          {
            id: 'crit-react',
            label: 'React & TypeScript frontend architecture',
            type: 'must-have',
            weight: 9,
            keywords: ['react', 'typescript']
          },
          {
            id: 'crit-pg',
            label: 'PostgreSQL database query tuning',
            type: 'must-have',
            weight: 8,
            keywords: ['postgresql', 'postgres']
          },
          {
            id: 'crit-docker',
            label: 'Docker containerization',
            type: 'nice-to-have',
            weight: 6,
            keywords: ['docker']
          }
        ]
      })
    });

    if (!criteriaRes.ok) {
      const errText = await criteriaRes.text();
      throw new Error(`Criteria update failed (${criteriaRes.status}): ${errText}`);
    }

    const criteriaData = (await criteriaRes.json()) as any;
    logSuccess(`Evaluation criteria saved & re-score enqueued (Candidates re-scored: ${criteriaData.enqueuedCount})`);

    // ---------------------------------------------------------
    // Step 6: Email Preview / Test Dispatch
    // ---------------------------------------------------------
    logStep(6, 'Exercising Email Account Mock & Test Email Preview');
    // Connect mock email account for testing
    const connectRes = await fetch(`${BASE_URL}/api/v1/email/mock-connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        provider: 'gmail',
        address: 'hr-sender@apexrecruitment.test'
      })
    });

    if (!connectRes.ok) {
      const errText = await connectRes.text();
      throw new Error(`Mock email connect failed (${connectRes.status}): ${errText}`);
    }

    logSuccess('Mock email sender connected (Address: hr-sender@apexrecruitment.test, Provider: Gmail)');

    // Dispatch test email
    const testEmailRes = await fetch(`${BASE_URL}/api/v1/email/batches/${batchId}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        kind: 'shortlisted'
      })
    });

    if (!testEmailRes.ok) {
      const errText = await testEmailRes.text();
      throw new Error(`Test email dispatch failed (${testEmailRes.status}): ${errText}`);
    }

    const testEmailData = (await testEmailRes.json()) as any;
    logSuccess(
      `Test email preview dispatched successfully (${testEmailData.message || 'Sent'})`
    );

    // ---------------------------------------------------------
    // Verification Completed
    // ---------------------------------------------------------
    console.log(`\n${colors.bold}${colors.green}======================================================${colors.reset}`);
    console.log(`${colors.bold}${colors.green}   ALL SMOKE TEST SCENARIOS PASSED SUCCESSFULLY!     ${colors.reset}`);
    console.log(`${colors.bold}${colors.green}======================================================${colors.reset}\n`);
    process.exit(0);
  } catch (error: any) {
    console.log(`\n${colors.bold}${colors.red}======================================================${colors.reset}`);
    logError(`Smoke test failed: ${error.message}`);
    console.log(`${colors.bold}${colors.red}======================================================${colors.reset}\n`);
    process.exit(1);
  }
}

runSmokeTest();
