import fs from 'fs';
import path from 'path';
import { scoreResume, scoreAgainstCriteria, CriterionItem } from '@shortlistiq/engine';

interface CandidateCheckRecord {
  id: string;
  jobTitle: string;
  company?: string | null;
  jdText: string;
  resumeText?: string | null;
  scoreBefore?: number | null;
  scoreAfter?: number | null;
  breakdown?: any;
}

interface SnapshotEntry {
  id: string;
  type: 'candidate_check' | 'batch_candidate';
  title: string;
  baselineScore: number;
  breakdown: {
    overallScore: number;
    keywordScore: number;
    skillsScore: number;
    experienceScore: number;
    formattingScore: number;
    readabilityScore: number;
    detectedYearsExperience: number;
    matchedKeywords: string[];
    missingKeywords: string[];
    matchedSkills: string[];
  };
  decision?: string;
  decisionReason?: string;
  notes?: string;
}

interface BaselineSnapshot {
  capturedAt: string;
  engineVersion: string;
  totalRecords: number;
  averageScore: number;
  entries: SnapshotEntry[];
}

export async function captureCurrentStateSnapshot(): Promise<BaselineSnapshot> {
  const possiblePaths = [
    path.resolve(process.cwd(), 'apps/api/.data/candidateChecks.json'),
    path.resolve(process.cwd(), '.data/candidateChecks.json'),
    path.resolve(process.cwd(), 'candidateChecks.json')
  ];

  let rawData = '[]';
  let foundPath = '';

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      rawData = fs.readFileSync(p, 'utf-8');
      foundPath = p;
      break;
    }
  }

  const checks: CandidateCheckRecord[] = JSON.parse(rawData || '[]');
  const entries: SnapshotEntry[] = [];

  for (const check of checks) {
    if (!check.resumeText || !check.jdText) continue;

    // Run baseline Engine V1 scoring
    const breakdown = scoreResume(check.resumeText, check.jdText);

    entries.push({
      id: check.id,
      type: 'candidate_check',
      title: check.jobTitle,
      baselineScore: breakdown.overallScore,
      breakdown: {
        overallScore: breakdown.overallScore,
        keywordScore: breakdown.keywordScore,
        skillsScore: breakdown.skillsScore,
        experienceScore: breakdown.experienceScore,
        formattingScore: breakdown.formattingScore,
        readabilityScore: breakdown.readabilityScore,
        detectedYearsExperience: breakdown.detectedYearsExperience,
        matchedKeywords: breakdown.matchedKeywords,
        missingKeywords: breakdown.missingKeywords,
        matchedSkills: breakdown.matchedSkills
      },
      notes: `Source check captured from ${foundPath || 'in-memory'}`
    });
  }

  // Also include a representative baseline sample of standard candidate profiles to anchor regression testing
  const sampleCandidateProfiles = [
    {
      id: 'baseline-sample-fullstack',
      type: 'batch_candidate' as const,
      title: 'Full Stack Engineer (Mid-Level)',
      jdText: 'Looking for a Full Stack Engineer with 3+ years experience in React, TypeScript, Node.js, PostgreSQL, Docker and AWS. REST APIs and CI/CD required.',
      resumeText: `Alex Morgan\nEmail: alex.morgan@example.com | Phone: 555-019-2834\n\nExperience\nFull Stack Developer | TechFlow Inc | 2021 - Present\n- Built scalable web applications with React, TypeScript, Node.js, and PostgreSQL.\n- Deployed containerized microservices using Docker and AWS ECS with GitHub Actions CI/CD.\n\nSoftware Engineer | Startup Lab | 2019 - 2021\n- Developed RESTful APIs with Express and PostgreSQL.\n\nEducation\nB.S. in Computer Science | State University | 2015 - 2019\n\nSkills\nJavaScript, TypeScript, React, Node.js, Express, PostgreSQL, Docker, AWS, Git, CI/CD`
    },
    {
      id: 'baseline-sample-entry-level',
      type: 'batch_candidate' as const,
      title: 'Junior Frontend Developer',
      jdText: 'Junior Frontend Developer with knowledge of JavaScript, React, HTML5, CSS3, Git, and responsive web design. Degree in CS or equivalent.',
      resumeText: `Jordan Taylor\nEmail: jordan.taylor@example.com | Phone: 555-012-3456\n\nEducation\nBachelor of Science in Computer Science | Tech College | 2020 - 2024\n\nProjects\nPortfolio Website & React Dashboard (2024)\n- Designed responsive UI using React, HTML5, CSS3, and Tailwind.\n- Managed version control with Git and GitHub.\n\nSkills\nJavaScript, React, HTML5, CSS3, Tailwind CSS, Git, Responsive Design`
    }
  ];

  for (const sample of sampleCandidateProfiles) {
    const sampleBreakdown = scoreResume(sample.resumeText, sample.jdText);
    entries.push({
      id: sample.id,
      type: sample.type,
      title: sample.title,
      baselineScore: sampleBreakdown.overallScore,
      breakdown: {
        overallScore: sampleBreakdown.overallScore,
        keywordScore: sampleBreakdown.keywordScore,
        skillsScore: sampleBreakdown.skillsScore,
        experienceScore: sampleBreakdown.experienceScore,
        formattingScore: sampleBreakdown.formattingScore,
        readabilityScore: sampleBreakdown.readabilityScore,
        detectedYearsExperience: sampleBreakdown.detectedYearsExperience,
        matchedKeywords: sampleBreakdown.matchedKeywords,
        missingKeywords: sampleBreakdown.missingKeywords,
        matchedSkills: sampleBreakdown.matchedSkills
      },
      notes: 'Anchored baseline profile for scoring regression safety'
    });
  }

  const totalScore = entries.reduce((acc, curr) => acc + curr.baselineScore, 0);
  const averageScore = entries.length > 0 ? Math.round((totalScore / entries.length) * 10) / 10 : 0;

  const snapshot: BaselineSnapshot = {
    capturedAt: new Date().toISOString(),
    engineVersion: 'Engine-V1-Baseline',
    totalRecords: entries.length,
    averageScore,
    entries
  };

  const outputDirs = [
    path.resolve(process.cwd(), '.data'),
    path.resolve(process.cwd(), 'apps/api/.data')
  ];

  for (const dir of outputDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const outputPath = path.join(dir, 'snapshot-baseline.json');
    fs.writeFileSync(outputPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log(`[Snapshot] Baseline state written to: ${outputPath}`);
  }

  return snapshot;
}

// Execute directly
captureCurrentStateSnapshot()
  .then((snap) => {
    console.log(`[Snapshot] Successfully captured ${snap.totalRecords} baseline records (Avg Score: ${snap.averageScore})`);
  })
  .catch((err) => {
    console.error('[Snapshot] Failed to capture snapshot:', err);
    process.exit(1);
  });
