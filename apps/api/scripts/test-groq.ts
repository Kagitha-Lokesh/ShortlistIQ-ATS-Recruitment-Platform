import { aiService } from '../src/services/ai.js';

async function main() {
  console.log('--- Testing Groq AI Candidate Summary ---');
  const summary = await aiService.summarizeCandidate(
    'Senior Full Stack Engineer',
    'Sarah Jenkins is a Senior Engineer with 6 years experience in React, TypeScript, Node.js, and Postgres at Acme Corp. Led team of 5 engineers to deliver multi-tenant platform.',
    88,
    ['react', 'typescript', 'node.js', 'postgres'],
    ['docker']
  );
  console.log('Result from Groq:');
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(console.error);
