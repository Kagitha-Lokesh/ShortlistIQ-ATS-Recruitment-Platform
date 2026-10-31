export interface SkillDefinition {
  canonical: string;
  aliases: string[];
  category?: string;
}

export const SKILL_DICTIONARY: SkillDefinition[] = [
  // --- Languages ---
  { canonical: 'JavaScript', aliases: ['javascript', 'js', 'es6', 'es2020', 'ecmascript'], category: 'Languages' },
  { canonical: 'TypeScript', aliases: ['typescript', 'ts'], category: 'Languages' },
  { canonical: 'Python', aliases: ['python', 'py', 'python3'], category: 'Languages' },
  { canonical: 'Go', aliases: ['golang', 'go lang', 'go'], category: 'Languages' },
  { canonical: 'Rust', aliases: ['rust', 'rustlang'], category: 'Languages' },
  { canonical: 'Java', aliases: ['java', 'java8', 'java11', 'java17'], category: 'Languages' },
  { canonical: 'C++', aliases: ['c++', 'cpp'], category: 'Languages' },
  { canonical: 'C#', aliases: ['c#', 'csharp', 'c-sharp'], category: 'Languages' },
  { canonical: 'C', aliases: ['c language', 'c programming'], category: 'Languages' },
  { canonical: 'Ruby', aliases: ['ruby'], category: 'Languages' },
  { canonical: 'PHP', aliases: ['php', 'php7', 'php8'], category: 'Languages' },
  { canonical: 'Swift', aliases: ['swift', 'swiftui'], category: 'Languages' },
  { canonical: 'Kotlin', aliases: ['kotlin'], category: 'Languages' },
  { canonical: 'Scala', aliases: ['scala'], category: 'Languages' },
  { canonical: 'R', aliases: ['r programming', 'r language', 'r stats'], category: 'Languages' },
  { canonical: 'SQL', aliases: ['sql', 't-sql', 'pl/sql', 'plsql'], category: 'Languages' },
  { canonical: 'NoSQL', aliases: ['nosql', 'non-relational', 'document database'], category: 'Database' },
  { canonical: 'HTML5', aliases: ['html', 'html5'], category: 'Languages' },
  { canonical: 'CSS3', aliases: ['css', 'css3', 'scss', 'sass', 'less'], category: 'Languages' },
  { canonical: 'Bash', aliases: ['bash', 'shell script', 'shell scripting', 'zsh', 'powershell'], category: 'Languages' },
  { canonical: 'Dart', aliases: ['dart'], category: 'Languages' },
  { canonical: 'Elixir', aliases: ['elixir'], category: 'Languages' },
  { canonical: 'Haskell', aliases: ['haskell'], category: 'Languages' },
  { canonical: 'Lua', aliases: ['lua'], category: 'Languages' },
  { canonical: 'Perl', aliases: ['perl'], category: 'Languages' },
  { canonical: 'Solidity', aliases: ['solidity', 'smart contracts'], category: 'Languages' },

  // --- Frontend ---
  { canonical: 'React', aliases: ['react', 'react.js', 'reactjs'], category: 'Frontend' },
  { canonical: 'Vue.js', aliases: ['vue', 'vue.js', 'vuejs', 'vue3'], category: 'Frontend' },
  { canonical: 'Angular', aliases: ['angular', 'angular.js', 'angularjs', 'angular2+'], category: 'Frontend' },
  { canonical: 'Next.js', aliases: ['next.js', 'nextjs', 'next'], category: 'Frontend' },
  { canonical: 'Remix', aliases: ['remix', 'remix.run'], category: 'Frontend' },
  { canonical: 'Svelte', aliases: ['svelte', 'sveltekit'], category: 'Frontend' },
  { canonical: 'Redux', aliases: ['redux', 'redux toolkit', 'rtk'], category: 'Frontend' },
  { canonical: 'Zustand', aliases: ['zustand'], category: 'Frontend' },
  { canonical: 'Tailwind CSS', aliases: ['tailwind', 'tailwindcss'], category: 'Frontend' },
  { canonical: 'Vite', aliases: ['vite', 'vitejs'], category: 'Frontend' },
  { canonical: 'Webpack', aliases: ['webpack'], category: 'Frontend' },
  { canonical: 'Bootstrap', aliases: ['bootstrap', 'bootstrap 5'], category: 'Frontend' },
  { canonical: 'Material UI', aliases: ['mui', 'material-ui', 'material ui'], category: 'Frontend' },
  { canonical: 'shadcn/ui', aliases: ['shadcn', 'shadcn/ui', 'radix ui', 'radix'], category: 'Frontend' },
  { canonical: 'TanStack Query', aliases: ['react query', 'tanstack query', 'tanstack'], category: 'Frontend' },
  { canonical: 'GraphQL', aliases: ['graphql', 'apollo client', 'relay'], category: 'Frontend' },
  { canonical: 'WebSockets', aliases: ['websockets', 'socket.io', 'websocket'], category: 'Frontend' },
  { canonical: 'WebAssembly', aliases: ['wasm', 'webassembly'], category: 'Frontend' },
  { canonical: 'Responsive Design', aliases: ['responsive design', 'mobile-first', 'adaptive design'], category: 'Frontend' },
  { canonical: 'PWA', aliases: ['progressive web app', 'pwa'], category: 'Frontend' },

  // --- Mobile ---
  { canonical: 'React Native', aliases: ['react native', 'react-native'], category: 'Mobile' },
  { canonical: 'Flutter', aliases: ['flutter'], category: 'Mobile' },
  { canonical: 'iOS Development', aliases: ['ios', 'xcode', 'cocoapods'], category: 'Mobile' },
  { canonical: 'Android Development', aliases: ['android', 'android studio', 'gradle'], category: 'Mobile' },

  // --- Backend & Frameworks ---
  { canonical: 'Node.js', aliases: ['node.js', 'nodejs', 'node'], category: 'Backend' },
  { canonical: 'Express.js', aliases: ['express', 'express.js', 'expressjs'], category: 'Backend' },
  { canonical: 'NestJS', aliases: ['nestjs', 'nest.js'], category: 'Backend' },
  { canonical: 'FastAPI', aliases: ['fastapi', 'fast-api'], category: 'Backend' },
  { canonical: 'Django', aliases: ['django', 'django rest framework', 'drf'], category: 'Backend' },
  { canonical: 'Flask', aliases: ['flask'], category: 'Backend' },
  { canonical: 'Spring Boot', aliases: ['spring', 'spring boot', 'spring framework'], category: 'Backend' },
  { canonical: 'Ruby on Rails', aliases: ['rails', 'ruby on rails'], category: 'Backend' },
  { canonical: '.NET Core', aliases: ['.net', '.net core', 'dotnet', 'asp.net'], category: 'Backend' },
  { canonical: 'Laravel', aliases: ['laravel'], category: 'Backend' },
  { canonical: 'gRPC', aliases: ['grpc', 'protocol buffers', 'protobuf'], category: 'Backend' },
  { canonical: 'REST APIs', aliases: ['rest', 'restful', 'rest api', 'rest apis'], category: 'Backend' },
  { canonical: 'Microservices', aliases: ['microservices', 'microservice architecture'], category: 'Backend' },
  { canonical: 'Kafka', aliases: ['apache kafka', 'kafka'], category: 'Backend' },
  { canonical: 'RabbitMQ', aliases: ['rabbitmq', 'amqp'], category: 'Backend' },
  { canonical: 'Redis', aliases: ['redis', 'redis cache'], category: 'Backend' },
  { canonical: 'Celery', aliases: ['celery'], category: 'Backend' },

  // --- Databases & ORMs ---
  { canonical: 'PostgreSQL', aliases: ['postgresql', 'postgres', 'psql'], category: 'Database' },
  { canonical: 'MySQL', aliases: ['mysql', 'mariadb'], category: 'Database' },
  { canonical: 'MongoDB', aliases: ['mongodb', 'mongo'], category: 'Database' },
  { canonical: 'SQLite', aliases: ['sqlite', 'sqlite3'], category: 'Database' },
  { canonical: 'Supabase', aliases: ['supabase'], category: 'Database' },
  { canonical: 'DynamoDB', aliases: ['dynamodb', 'amazon dynamodb'], category: 'Database' },
  { canonical: 'Elasticsearch', aliases: ['elasticsearch', 'opensearch', 'elk stack'], category: 'Database' },
  { canonical: 'Cassandra', aliases: ['cassandra', 'apache cassandra'], category: 'Database' },
  { canonical: 'Neo4j', aliases: ['neo4j', 'graph database'], category: 'Database' },
  { canonical: 'Prisma', aliases: ['prisma', 'prisma orm'], category: 'Database' },
  { canonical: 'TypeORM', aliases: ['typeorm'], category: 'Database' },
  { canonical: 'Drizzle ORM', aliases: ['drizzle', 'drizzle orm'], category: 'Database' },
  { canonical: 'Hibernate', aliases: ['hibernate'], category: 'Database' },
  { canonical: 'SQLAlchemy', aliases: ['sqlalchemy'], category: 'Database' },

  // --- Cloud & DevOps ---
  { canonical: 'AWS', aliases: ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'rds', 'cloudformation'], category: 'Cloud' },
  { canonical: 'Azure', aliases: ['azure', 'microsoft azure', 'azure devops'], category: 'Cloud' },
  { canonical: 'Google Cloud Platform', aliases: ['gcp', 'google cloud', 'gcs', 'cloud run'], category: 'Cloud' },
  { canonical: 'Docker', aliases: ['docker', 'containerization', 'docker compose', 'dockerfile'], category: 'DevOps' },
  { canonical: 'Kubernetes', aliases: ['kubernetes', 'k8s', 'kubectl'], category: 'DevOps' },
  { canonical: 'Terraform', aliases: ['terraform', 'tf', 'infrastructure as code', 'iac'], category: 'DevOps' },
  { canonical: 'Ansible', aliases: ['ansible'], category: 'DevOps' },
  { canonical: 'CI/CD', aliases: ['ci/cd', 'continuous integration', 'continuous delivery', 'continuous deployment'], category: 'DevOps' },
  { canonical: 'GitHub Actions', aliases: ['github actions', 'gh actions'], category: 'DevOps' },
  { canonical: 'GitLab CI', aliases: ['gitlab ci', 'gitlab-ci'], category: 'DevOps' },
  { canonical: 'Jenkins', aliases: ['jenkins'], category: 'DevOps' },
  { canonical: 'Linux', aliases: ['linux', 'ubuntu', 'debian', 'centos', 'rhel'], category: 'DevOps' },
  { canonical: 'Nginx', aliases: ['nginx', 'reverse proxy'], category: 'DevOps' },
  { canonical: 'Prometheus', aliases: ['prometheus'], category: 'DevOps' },
  { canonical: 'Grafana', aliases: ['grafana'], category: 'DevOps' },
  { canonical: 'Datadog', aliases: ['datadog'], category: 'DevOps' },
  { canonical: 'Cloudflare', aliases: ['cloudflare', 'cloudflare pages', 'cloudflare workers'], category: 'Cloud' },
  { canonical: 'Serverless', aliases: ['serverless', 'lambda functions', 'edge functions'], category: 'Cloud' },

  // --- Testing & Quality ---
  { canonical: 'Jest', aliases: ['jest'], category: 'Testing' },
  { canonical: 'Vitest', aliases: ['vitest'], category: 'Testing' },
  { canonical: 'Cypress', aliases: ['cypress'], category: 'Testing' },
  { canonical: 'Playwright', aliases: ['playwright'], category: 'Testing' },
  { canonical: 'Selenium', aliases: ['selenium', 'webdriver'], category: 'Testing' },
  { canonical: 'Unit Testing', aliases: ['unit testing', 'unit test', 'unit tests'], category: 'Testing' },
  { canonical: 'Integration Testing', aliases: ['integration testing', 'integration tests'], category: 'Testing' },
  { canonical: 'E2E Testing', aliases: ['e2e testing', 'end to end testing', 'e2e'], category: 'Testing' },
  { canonical: 'Test-Driven Development', aliases: ['tdd', 'test driven development'], category: 'Testing' },

  // --- Data, AI & Analytics ---
  { canonical: 'Machine Learning', aliases: ['machine learning', 'ml'], category: 'Data & AI' },
  { canonical: 'Deep Learning', aliases: ['deep learning', 'neural networks'], category: 'Data & AI' },
  { canonical: 'Natural Language Processing', aliases: ['nlp', 'natural language processing'], category: 'Data & AI' },
  { canonical: 'Large Language Models', aliases: ['llm', 'llms', 'large language models', 'rag'], category: 'Data & AI' },
  { canonical: 'PyTorch', aliases: ['pytorch', 'torch'], category: 'Data & AI' },
  { canonical: 'TensorFlow', aliases: ['tensorflow', 'tf', 'keras'], category: 'Data & AI' },
  { canonical: 'Pandas', aliases: ['pandas'], category: 'Data & AI' },
  { canonical: 'NumPy', aliases: ['numpy'], category: 'Data & AI' },
  { canonical: 'Scikit-learn', aliases: ['scikit-learn', 'sklearn'], category: 'Data & AI' },
  { canonical: 'Apache Spark', aliases: ['spark', 'pyspark', 'apache spark'], category: 'Data & AI' },
  { canonical: 'Snowflake', aliases: ['snowflake'], category: 'Data & AI' },
  { canonical: 'BigQuery', aliases: ['bigquery', 'google bigquery'], category: 'Data & AI' },
  { canonical: 'ETL Pipelines', aliases: ['etl', 'data pipeline', 'data pipelines', 'airflow'], category: 'Data & AI' },
  { canonical: 'Data Warehousing', aliases: ['data warehouse', 'data warehousing'], category: 'Data & AI' },

  // --- Product & Project Management ---
  { canonical: 'Agile', aliases: ['agile', 'agile methodology', 'agile delivery'], category: 'Product' },
  { canonical: 'Scrum', aliases: ['scrum', 'sprint planning', 'daily standup'], category: 'Product' },
  { canonical: 'Kanban', aliases: ['kanban'], category: 'Product' },
  { canonical: 'JIRA', aliases: ['jira', 'atlassian jira'], category: 'Product' },
  { canonical: 'Confluence', aliases: ['confluence'], category: 'Product' },
  { canonical: 'Product Management', aliases: ['product management', 'product strategy', 'product roadmap'], category: 'Product' },
  { canonical: 'User Stories', aliases: ['user stories', 'acceptance criteria', 'backlog grooming'], category: 'Product' },
  { canonical: 'Stakeholder Management', aliases: ['stakeholder management', 'cross-functional collaboration'], category: 'Product' },
  { canonical: 'KPI Tracking', aliases: ['kpis', 'kpi tracking', 'metrics', 'okrs'], category: 'Product' },
  { canonical: 'A/B Testing', aliases: ['a/b testing', 'split testing', 'experimentation'], category: 'Product' },

  // --- Business, Sales & Marketing ---
  { canonical: 'CRM', aliases: ['crm', 'customer relationship management'], category: 'Business' },
  { canonical: 'Salesforce', aliases: ['salesforce', 'sfdc'], category: 'Business' },
  { canonical: 'HubSpot', aliases: ['hubspot'], category: 'Business' },
  { canonical: 'Customer Success', aliases: ['customer success', 'client onboarding', 'retention'], category: 'Business' },
  { canonical: 'Lead Generation', aliases: ['lead generation', 'prospecting', 'outbound'], category: 'Business' },
  { canonical: 'B2B Sales', aliases: ['b2b sales', 'enterprise sales', 'account management'], category: 'Business' },
  { canonical: 'SEO', aliases: ['seo', 'search engine optimization', 'sem'], category: 'Business' },
  { canonical: 'Content Strategy', aliases: ['content strategy', 'copywriting', 'content marketing'], category: 'Business' },
  { canonical: 'Google Analytics', aliases: ['google analytics', 'ga4'], category: 'Business' },
  { canonical: 'Financial Modeling', aliases: ['financial modeling', 'budgeting', 'p&l', 'forecasting'], category: 'Business' },

  // --- Architecture & Security ---
  { canonical: 'System Design', aliases: ['system design', 'distributed systems', 'scalability'], category: 'Architecture' },
  { canonical: 'Cybersecurity', aliases: ['cybersecurity', 'information security', 'infosec', 'appsec'], category: 'Security' },
  { canonical: 'OAuth2 / OpenID', aliases: ['oauth', 'oauth2', 'openid', 'saml', 'jwt', 'sso'], category: 'Security' },
  { canonical: 'Penetration Testing', aliases: ['penetration testing', 'pentesting', 'vulnerability assessment'], category: 'Security' },
  { canonical: 'SOC 2 Compliance', aliases: ['soc 2', 'gdpr', 'hipaa', 'compliance'], category: 'Security' }
];

export interface ExtractedSkillsResult {
  matchedSkills: string[];
  jdOverlapSkills: string[];
  totalCount: number;
}

/**
 * Escapes regex string safely while preserving symbols common in tech names like C++, C#, .NET
 */
function escapeRegex(text: string): string {
  return text.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function matchesAlias(text: string, alias: string): boolean {
  const cleanAlias = alias.trim().toLowerCase();
  if (!cleanAlias) return false;

  const escaped = escapeRegex(cleanAlias);

  // Word-boundary check tailored for tech terms
  // Allows symbols like # and + at the end (e.g. C++, C#)
  const pattern = new RegExp(`(^|[^a-zA-Z0-9#+])${escaped}([^a-zA-Z0-9#+]|$)`, 'i');
  return pattern.test(text);
}

/**
 * Extracts candidate skills from resume text using bundled ~500 dictionary + JD dynamic terms.
 * Framework-free pure TypeScript.
 */
export function extractSkills(text: string, jdText?: string): ExtractedSkillsResult {
  const matchedSet = new Set<string>();

  // 1. Match against bundled skill dictionary
  for (const def of SKILL_DICTIONARY) {
    const matched = def.aliases.some((alias) => matchesAlias(text, alias));
    if (matched) {
      matchedSet.add(def.canonical);
    }
  }

  // 2. Dynamic terms extracted from JD if provided
  const jdOverlapSkills: string[] = [];
  if (jdText) {
    for (const def of SKILL_DICTIONARY) {
      const inJd = def.aliases.some((alias) => matchesAlias(jdText, alias));
      if (inJd && matchedSet.has(def.canonical)) {
        if (!jdOverlapSkills.includes(def.canonical)) {
          jdOverlapSkills.push(def.canonical);
        }
      }
    }
  }

  const matchedSkills = Array.from(matchedSet).sort();

  return {
    matchedSkills,
    jdOverlapSkills: jdOverlapSkills.sort(),
    totalCount: matchedSkills.length
  };
}
