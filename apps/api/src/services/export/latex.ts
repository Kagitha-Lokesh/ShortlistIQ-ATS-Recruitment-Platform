import { ResumeData, TemplateThemeOptions } from '@shortlistiq/shared';
import { logger } from '../../logger.js';
import { AppError } from '../../middleware/errorHandler.js';

const LATEX_COMPILE_URL = 'https://latex.ytotech.com/builds/sync';

// Map of theme colors to RGB tuples for LaTeX xcolor package
const ACCENT_COLOR_MAP: Record<string, { rgb: string; hex: string }> = {
  indigo:   { rgb: '55,48,163',   hex: '#3730A3' },
  slate:    { rgb: '51,65,85',    hex: '#334155' },
  navy:     { rgb: '30,58,138',   hex: '#1E3A8A' },
  forest:   { rgb: '22,101,52',   hex: '#166534' },
  charcoal: { rgb: '24,24,27',    hex: '#18181B' }
};

export interface LatexOptions extends Partial<TemplateThemeOptions> {
  template?: 'modern' | 'classic' | 'compact' | 'minimal';
  accentColor?: 'indigo' | 'slate' | 'navy' | 'forest' | 'charcoal';
  fontSize?: 'small' | 'medium' | 'large';
  margins?: 'compact' | 'normal' | 'spacious';
}

/**
 * Robust escaping of special LaTeX characters for generic text from any resume.
 */
export function esc(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/~/g, '\\textasciitilde{}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/</g, '\\textless{}')
    .replace(/>/g, '\\textgreater{}')
    .replace(/\|/g, '\\textbar{}')
    .replace(/"/g, "''");
}

/**
 * Generic bullet de-fragmentation for PDF-extracted text.
 * Joins orphan lines that were soft-wrapped across lines in the source PDF.
 */
function normalizeBullets(bullets: string[]): string[] {
  const normalized: string[] = [];
  for (const item of bullets) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    // Check if current item is a continuation line:
    // Starts with a lowercase letter, or continuation words, or previous line had no end punctuation
    const isContinuation =
      normalized.length > 0 &&
      (/^[a-z]/.test(trimmed) ||
       /^(and|or|with|in|to|for|by|including|etc\.)\b/i.test(trimmed) ||
       (!/[.!?;:]$/.test(normalized[normalized.length - 1]) && trimmed.length < 50));

    if (isContinuation) {
      normalized[normalized.length - 1] += ' ' + trimmed;
    } else {
      normalized.push(trimmed);
    }
  }
  return normalized;
}

/**
 * Cleans generic structural artifacts left by resume parsers (e.g. "/ Company", "— University")
 */
function cleanEntityName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .replace(/\s*[\/—–-]\s*(Company|University|College|School|Institution|Organization)\b/gi, '')
    .trim();
}

/**
 * Determines whether the summary contains real descriptive sentences or is an artifact of the parser.
 */
function isGenuineSummary(summary: string | null | undefined, contact: ResumeData['contact']): boolean {
  if (!summary) return false;
  const s = summary.trim();
  if (s.length < 25) return false;

  // If summary is just an echo of the contact info (contains email / phone / address fragments)
  if (contact.email && s.includes(contact.email)) return false;
  if (contact.phone && s.includes(contact.phone)) return false;
  if (contact.fullName && s.startsWith(contact.fullName) && s.length < 120) return false;

  // Must have spaces and reasonable word count
  const words = s.split(/\s+/).filter(Boolean);
  return words.length >= 6;
}

/**
 * Formats date ranges consistently (e.g. "2022 -- 2026", "Jan 2021 -- Present", "2020")
 */
function formatDateRange(startDate?: string | null, endDate?: string | null): string {
  const start = (startDate || '').trim();
  const end = (endDate || '').trim();
  if (start && end) return `${start} -- ${end}`;
  if (start) return `${start} -- Present`;
  if (end) return end;
  return '';
}

/**
 * Generates an ATS-compliant, production-grade LaTeX document from ANY ResumeData.
 * Adapts to Modern, Classic, Compact, and Minimal templates with chosen accent colors.
 */
export function generateLatexSource(resume: ResumeData, options: LatexOptions = {}): string {
  const template    = options.template    || 'modern';
  const accentKey   = options.accentColor || 'indigo';
  const fontSizeOpt = options.fontSize    || 'medium';
  const marginsOpt  = options.margins     || 'normal';

  const accent = ACCENT_COLOR_MAP[accentKey] || ACCENT_COLOR_MAP.indigo;

  // Document font size
  const docFontSize = fontSizeOpt === 'small' ? '10pt' : fontSizeOpt === 'large' ? '12pt' : '11pt';

  // Margins adjustment
  const marginOffset =
    marginsOpt === 'compact'  ? '-0.6in' :
    marginsOpt === 'spacious' ? '-0.25in' : '-0.5in';

  // Template design characteristics
  const isClassic = template === 'classic';
  const isMinimal = template === 'minimal';
  const isModern  = template === 'modern';

  // Section title styling
  const sectionTitleColor = isClassic ? '\\color{black}' : '\\color{accentcol}';
  const sectionRule = isMinimal
    ? ''
    : isClassic
    ? `[\\color{black}\\titlerule \\vspace{-5pt}]`
    : `[\\color{accentcol}\\titlerule \\vspace{-5pt}]`;

  // Item bullet style
  const itemBullet = isClassic ? '--' : '$\\bullet$';

  // ── Contact Line ─────────────────────────────────────────────────────────────
  const c = resume.contact;
  const contactItems: string[] = [];

  if (c.phone) {
    contactItems.push(`\\faPhone\\ ${esc(c.phone)}`);
  }
  if (c.email && c.email !== 'NO_EMAIL') {
    contactItems.push(`\\faEnvelope\\ \\href{mailto:${esc(c.email)}}{${esc(c.email)}}`);
  }
  if (c.linkedin) {
    const url = c.linkedin.startsWith('http') ? c.linkedin : `https://${c.linkedin}`;
    contactItems.push(`\\faLinkedin\\ \\href{${esc(url)}}{LinkedIn}`);
  }
  if (c.github) {
    const url = c.github.startsWith('http') ? c.github : `https://${c.github}`;
    contactItems.push(`\\faGithub\\ \\href{${esc(url)}}{GitHub}`);
  }
  if (c.website) {
    const url = c.website.startsWith('http') ? c.website : `https://${c.website}`;
    contactItems.push(`\\faGlobe\\ \\href{${esc(url)}}{Portfolio}`);
  }

  const contactLine = contactItems.join(' \\quad ');

  // ── Section 1: Summary (if genuine) ──────────────────────────────────────────
  let summaryBlock = '';
  if (isGenuineSummary(resume.summary, c)) {
    summaryBlock = `
\\section{Professional Summary}
\\begin{itemize}[leftmargin=0.15in, label={}]
  \\small{\\item{${esc(resume.summary)}}}
\\end{itemize}
\\vspace{-6pt}`;
  }

  // ── Section 2: Education ─────────────────────────────────────────────────────
  let educationBlock = '';
  if (resume.education && resume.education.length > 0) {
    // Deduplicate and consolidate any fragmented parser lines
    const isGenericInst = (s: string) => /^(University|College|University\s*\/\s*College|School|Institution)$/i.test(s.trim());
    const isLocationOnly = (s: string) => /^(Andhra Pradesh|Telangana|Karnataka|Maharashtra|Tamil Nadu|India|California|CA|NY|TX|USA|[A-Z][a-z]+,\s*[A-Z][a-z]+)$/i.test(s.trim());

    const normalizedEducation: Array<{
      institution: string;
      degree: string;
      location: string;
      dateStr: string;
      gpaStr: string;
    }> = [];

    let pendingEdu: {
      institution: string;
      degree: string;
      location: string;
      dateStr: string;
      gpaStr: string;
    } | null = null;

    for (const edu of resume.education) {
      let inst = cleanEntityName(edu.institution);
      let deg = cleanEntityName(edu.degree);
      const dateStr = formatDateRange(edu.startDate, edu.endDate);
      const gpaStr = edu.gpa ? ` --- CGPA: ${esc(String(edu.gpa))}` : '';
      let loc = (edu.location || '').trim();

      // If degree is just a lone state/location, attach to pending
      if (isLocationOnly(deg) && pendingEdu) {
        if (!pendingEdu.location) pendingEdu.location = deg;
        continue;
      }

      // If institution is generic placeholder ("University") but degree actually contains the institution name
      if (isGenericInst(inst) && /(Institute|College|University|School|Academy|Polytechnic|Vidyalaya)/i.test(deg)) {
        inst = deg;
        deg = '';
      }

      // If this line is a degree description following an institution line
      if (pendingEdu && isGenericInst(inst) && deg) {
        if (!pendingEdu.degree) {
          pendingEdu.degree = deg;
          if (loc && !pendingEdu.location) pendingEdu.location = loc;
          if (dateStr && !pendingEdu.dateStr) pendingEdu.dateStr = dateStr;
          continue;
        }
      }

      if (pendingEdu && !pendingEdu.degree && /(Education|School|Intermediate|B\.Tech|Degree|Bachelor|Master)/i.test(deg || inst)) {
        pendingEdu.degree = deg || inst;
        if (dateStr && !pendingEdu.dateStr) pendingEdu.dateStr = dateStr;
        continue;
      }

      if (pendingEdu) {
        normalizedEducation.push(pendingEdu);
        pendingEdu = null;
      }

      pendingEdu = {
        institution: isGenericInst(inst) && deg ? deg : (inst || 'University'),
        degree: isGenericInst(inst) && deg ? '' : deg,
        location: loc,
        dateStr,
        gpaStr
      };
    }
    if (pendingEdu) {
      normalizedEducation.push(pendingEdu);
    }

    if (normalizedEducation.length > 0) {
      educationBlock = `
\\section{Education}
  \\resumeSubHeadingListStart
${normalizedEducation.map(edu => {
  return `    \\resumeSubheading
      {${esc(edu.institution)}}{${esc(edu.dateStr)}}
      {${esc(edu.degree)}${edu.gpaStr}}{${esc(edu.location)}}`;
}).join('\n')}
  \\resumeSubHeadingListEnd`;
    }
  }

  // ── Section 3: Experience ────────────────────────────────────────────────────
  let experienceBlock = '';
  if (resume.experience && resume.experience.length > 0) {
    const normalizedExperience = resume.experience.map(exp => {
      let company = cleanEntityName(exp.company);
      let title = (exp.title || '').trim();
      let location = (exp.location || '').trim();
      let bullets = normalizeBullets(exp.highlights || []);

      // If company is generic "Company" but title is actually a company name (e.g. contains PVT LTD, INC, TECH, CORP)
      if ((!company || company.toLowerCase() === 'company') && /(PVT\s*LTD|INC|LLC|CORP|SOLUTIONS|TECHNOLOGIES|LIMITED)/i.test(title)) {
        company = title;
        title = '';
      }

      // If title is missing or still "Company", extract from first bullet if it contains role & location
      if ((!title || title.toLowerCase() === 'company') && bullets.length > 0) {
        const firstB = bullets[0];
        const roleMatch = firstB.match(/^(.*?(?:Developer|Engineer|Manager|Intern|Architect|Lead|Analyst|Consultant|Specialist|Designer)(?:\s+Intern)?)\s+(.*)$/i);
        if (roleMatch) {
          title = roleMatch[1].trim();
          if (roleMatch[2] && !location) location = roleMatch[2].trim();
          bullets = bullets.slice(1);
        } else {
          title = firstB;
          bullets = bullets.slice(1);
        }
      }

      const dateStr = formatDateRange(exp.startDate, exp.endDate);

      return {
        company: company || 'Organization',
        title: title || 'Position',
        location,
        dateStr,
        highlights: bullets
      };
    });

    experienceBlock = `
\\section{Work Experience}
  \\resumeSubHeadingListStart
${normalizedExperience.map(exp => {
  return `    \\resumeSubheading
      {${esc(exp.company)}}{${esc(exp.dateStr)}}
      {${esc(exp.title)}}{${esc(exp.location)}}
      \\resumeItemListStart
${exp.highlights.map(b => `        \\resumeItem{${esc(b)}}`).join('\n')}
      \\resumeItemListEnd`;
}).join('\n')}
  \\resumeSubHeadingListEnd`;
  }

  // ── Section 4: Technical Skills ──────────────────────────────────────────────
  let skillsBlock = '';
  if (resume.skills && resume.skills.length > 0) {
    skillsBlock = `
\\section{Technical Skills}
 \\begin{itemize}[leftmargin=0.15in, label={}]
    \\small{\\item{
     ${resume.skills.map(s =>
       `\\textbf{${esc(s.category)}:} ${esc(s.items.join(', '))}`
     ).join(' \\\\\n     ')}
    }}
 \\end{itemize}
 \\vspace{-8pt}`;
  }

  // ── Section 5: Projects ──────────────────────────────────────────────────────
  let projectsBlock = '';
  if (resume.projects && resume.projects.length > 0) {
    projectsBlock = `
\\section{Projects}
    \\resumeSubHeadingListStart
${resume.projects.map(p => {
  let name = p.name || 'Project';
  let techStr = (p.technologies && p.technologies.length > 0) ? p.technologies.join(', ') : '';

  // Generic parsing if technologies are included in the name like "Name | Tech1, Tech2"
  if (name.includes('|')) {
    const parts = name.split('|');
    name = parts[0].trim();
    if (!techStr) techStr = parts.slice(1).join(', ').trim();
  }

  // Generic year extraction if embedded
  const yearMatch = (p.name + ' ' + (p.description || '')).match(/\b(20\d\d)\b/);
  const dateStr = yearMatch ? yearMatch[1] : '';

  const bullets = normalizeBullets(p.highlights || []);

  return `      \\resumeProjectHeading
          {\\textbf{${esc(name)}}${techStr ? ` $|$ \\emph{${esc(techStr)}}` : ''}}{\\textbf{${esc(dateStr)}}}
          \\resumeItemListStart
${bullets.map(b => {
  // Format hyperlinks if present in bullet
  if (/^Live (Website|Portfolio|Demo|App):/i.test(b)) {
    const linkMatch = b.match(/^Live ([^:]+):\s*(https?:\/\/[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}[^\s]*)/i);
    if (linkMatch) {
      const label = linkMatch[1];
      const rawUrl = linkMatch[2];
      const fullUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
      return `            \\resumeItem{\\textbf{Live ${esc(label)}:} \\href{${esc(fullUrl)}}{${esc(rawUrl)}}}`;
    }
  }
  return `            \\resumeItem{${esc(b)}}`;
}).join('\n')}
          \\resumeItemListEnd`;
}).join('\n')}
    \\resumeSubHeadingListEnd`;
  }

  // ── Section 6: Certifications ────────────────────────────────────────────────
  let certBlock = '';
  if (resume.certifications && resume.certifications.length > 0) {
    certBlock = `
\\section{Certifications}
 \\begin{itemize}[leftmargin=1.5em, itemsep=1pt, topsep=1pt, parsep=0pt, label=$\\bullet$]
    \\small{
${resume.certifications.map(cert => {
  const issuerStr = cert.issuer ? ` -- ${esc(cert.issuer)}` : '';
  const dateStr = cert.date ? ` (${esc(cert.date)})` : '';
  return `      \\item ${esc(cert.name)}${issuerStr}${dateStr}`;
}).join('\n')}
    }
 \\end{itemize}`;
  }

  // ── Determine Section Order ──────────────────────────────────────────────────
  // If candidate has substantial experience, experience precedes education.
  // For students / fresh graduates, education precedes experience.
  const hasSubstantialExp = (resume.experience || []).length >= 2;
  const mainContentOrder = hasSubstantialExp
    ? [summaryBlock, experienceBlock, projectsBlock, educationBlock, skillsBlock, certBlock]
    : [summaryBlock, educationBlock, experienceBlock, skillsBlock, projectsBlock, certBlock];

  const bodySections = mainContentOrder.filter(Boolean).join('\n');

  // ── Header Alignment ─────────────────────────────────────────────────────────
  const headerCenter = isClassic || isModern;
  const candidateHeader = headerCenter
    ? `\\begin{center}
    {\\Huge \\textsc{\\textbf{${isModern ? '{\\color{accentcol}' : ''}${esc(c.fullName || 'Candidate Name')}${isModern ? '}' : ''}}}} \\\\ \\vspace{2pt}
    ${c.location ? `{\\small ${esc(c.location)}} \\\\ \\vspace{2pt}` : ''}
    {\\small ${contactLine}}
\\end{center}`
    : `\\begin{flushleft}
    {\\Huge \\textbf{${isModern ? '{\\color{accentcol}' : ''}${esc(c.fullName || 'Candidate Name')}${isModern ? '}' : ''}}} \\\\ \\vspace{2pt}
    ${c.location ? `{\\small ${esc(c.location)}} \\\\ \\vspace{2pt}` : ''}
    {\\small ${contactLine}}
\\end{flushleft}`;

  return `%-----------------------------------------------------------------------------
% ShortlistIQ ATS Resume Engine
% Universally ATS-Compliant LaTeX Document
% Template: ${template} | Accent: ${accentKey} | Font: ${fontSizeOpt}
%-----------------------------------------------------------------------------

\\documentclass[letterpaper,${docFontSize}]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{xcolor}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}
\\usepackage{fontawesome5}
\\input{glyphtounicode}

% Font selection
${isClassic ? '\\usepackage{mathptmx}' : '\\usepackage{lmodern}'}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

% Color definition
\\definecolor{accentcol}{RGB}{${accent.rgb}}

% Margins
\\addtolength{\\oddsidemargin}{${marginOffset}}
\\addtolength{\\evensidemargin}{${marginOffset}}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.5in}
\\addtolength{\\textheight}{1.0in}

\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

% Section formatting
\\titleformat{\\section}{
  \\vspace{-4pt}\\raggedright\\large\\bfseries${sectionTitleColor}
}{}{0em}{}${sectionRule}

\\pdfgentounicode=1

% Reusable commands
\\newcommand{\\resumeItem}[1]{
  \\item\\small{
    {#1 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-2pt}\\item
    \\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & \\textbf{#2} \\\\
      \\textit{\\small#3} & \\textit{\\small #4} \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeProjectHeading}[2]{
    \\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\small#1 & #2 \\\\
    \\end{tabular*}\\vspace{-7pt}
}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}[leftmargin=1.5em, itemsep=1.5pt, topsep=1.5pt, parsep=0pt, label=${itemBullet}]}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

%-----------------------------------------------------------------------------
\\begin{document}

${candidateHeader}

${bodySections}

\\end{document}
`;
}

/**
 * Compiles LaTeX source to PDF using the latex.ytotech.com free cloud compiler.
 * Returns a Buffer containing the compiled PDF.
 */
export async function compileLatexToPdf(latexSource: string): Promise<Buffer> {
  logger.info('Compiling LaTeX resume via cloud compiler...');

  let res: Response;
  try {
    res = await fetch(LATEX_COMPILE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compiler: 'pdflatex',
        resources: [{ main: true, content: latexSource }]
      }),
      signal: AbortSignal.timeout(45_000)
    });
  } catch (err: any) {
    throw new AppError(
      503,
      'LATEX_COMPILE_UNAVAILABLE',
      'LaTeX compilation service is temporarily unavailable. Please try again or use the PDF/Word export.'
    );
  }

  if (res.status === 201 || (res.ok && res.headers.get('content-type')?.includes('application/pdf'))) {
    const arrayBuffer = await res.arrayBuffer();
    logger.info({ bytes: arrayBuffer.byteLength }, 'LaTeX PDF compiled successfully');
    return Buffer.from(arrayBuffer);
  }

  // On compilation error, latex.ytotech returns a JSON with logs
  let errorDetail = `HTTP ${res.status}`;
  try {
    const errJson = await res.json() as { errors?: string[]; logs?: string };
    if (errJson.errors?.length) errorDetail = errJson.errors.join('; ');
    else if (errJson.logs) errorDetail = errJson.logs.slice(0, 300);
  } catch {
    // Ignored
  }

  logger.error({ errorDetail }, 'LaTeX compilation failed');
  throw new AppError(
    422,
    'LATEX_COMPILE_ERROR',
    `LaTeX compilation failed: ${errorDetail}`
  );
}

/**
 * Full pipeline: ResumeData → LaTeX source → compiled PDF buffer
 */
export async function generateResumeLatexPdf(resume: ResumeData, opts: LatexOptions = {}): Promise<Buffer> {
  const latexSource = generateLatexSource(resume, opts);
  return compileLatexToPdf(latexSource);
}
