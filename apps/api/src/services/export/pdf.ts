import pdfmakeModule from 'pdfmake';
import { TDocumentDefinitions, Content } from 'pdfmake/interfaces';
import { ResumeData, TemplateThemeOptions } from '@shortlistiq/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const pdfmake: any = (pdfmakeModule as any).default || pdfmakeModule;

// Register standard fonts
pdfmake.fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  },
  Times: {
    normal: 'Times-Roman',
    bold: 'Times-Bold',
    italics: 'Times-Italic',
    bolditalics: 'Times-BoldItalic'
  }
};

pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy(() => true);

const ACCENT_COLORS: Record<string, string> = {
  indigo: '#3730A3',
  slate: '#334155',
  navy: '#1E3A8A',
  forest: '#166534',
  charcoal: '#18181B'
};

const FONT_SIZES: Record<string, { body: number; heading: number; title: number; sub: number }> = {
  small: { body: 9, heading: 11, title: 18, sub: 8.5 },
  medium: { body: 10, heading: 12.5, title: 20, sub: 9.5 },
  large: { body: 11, heading: 14, title: 22, sub: 10.5 }
};

const MARGIN_CONFIG: Record<string, number> = {
  compact: 36, // 0.5 in
  normal: 50,  // ~0.7 in
  spacious: 64 // ~0.9 in
};

/**
 * Builds standard single-column ATS section heading
 */
function createSectionHeader(
  title: string,
  template: string,
  accentColor: string,
  fontSize: number
): Content[] {
  const content: Content[] = [];

  content.push({
    text: title.toUpperCase(),
    fontSize,
    bold: true,
    color: template === 'classic' || template === 'minimal' ? '#0F172A' : accentColor,
    margin: [0, 10, 0, 3]
  });

  if (template !== 'minimal') {
    content.push({
      canvas: [
        {
          type: 'line',
          x1: 0,
          y1: 0,
          x2: 500,
          y2: 0,
          lineWidth: template === 'modern' ? 1.5 : 0.75,
          lineColor: template === 'modern' ? accentColor : '#CBD5E1'
        }
      ],
      margin: [0, 0, 0, 6]
    });
  }

  return content;
}

/**
 * Generates ATS-compliant, single-column PDF using pdfmake
 */
export async function generateResumePdf(
  resume: ResumeData,
  options: Partial<TemplateThemeOptions> = {}
): Promise<Buffer> {
  const {
    template = 'modern',
    accentColor = 'indigo',
    fontSize = 'medium',
    margins = 'normal'
  } = options;

  const colorHex = ACCENT_COLORS[accentColor] || ACCENT_COLORS.indigo;
  const sizes = FONT_SIZES[fontSize] || FONT_SIZES.medium;
  const pageMargin = MARGIN_CONFIG[margins] || MARGIN_CONFIG.normal;
  const defaultFont = template === 'classic' ? 'Times' : 'Helvetica';

  const docContent: Content[] = [];

  // 1. Header (Name & Contact)
  const contactParts: string[] = [];
  if (resume.contact.email && resume.contact.email !== 'NO_EMAIL') contactParts.push(resume.contact.email);
  if (resume.contact.phone) contactParts.push(resume.contact.phone);
  if (resume.contact.location) contactParts.push(resume.contact.location);
  if (resume.contact.linkedin) contactParts.push(resume.contact.linkedin);
  if (resume.contact.github) contactParts.push(resume.contact.github);
  if (resume.contact.website) contactParts.push(resume.contact.website);

  const contactLine = contactParts.join('  •  ');

  docContent.push({
    text: resume.contact.fullName || 'Candidate Name',
    fontSize: sizes.title,
    bold: true,
    alignment: template === 'classic' ? 'center' : 'left',
    color: template === 'modern' ? colorHex : '#0F172A',
    margin: [0, 0, 0, 2]
  });

  if (contactLine) {
    docContent.push({
      text: contactLine,
      fontSize: sizes.sub,
      alignment: template === 'classic' ? 'center' : 'left',
      color: '#475569',
      margin: [0, 0, 0, 10]
    });
  }

  // 2. Professional Summary
  if (resume.summary && resume.summary.trim().length > 0) {
    docContent.push(...createSectionHeader('Professional Summary', template, colorHex, sizes.heading));
    docContent.push({
      text: resume.summary.trim(),
      fontSize: sizes.body,
      lineHeight: 1.25,
      color: '#1E293B',
      margin: [0, 0, 0, 8]
    });
  }

  // 3. Technical Skills
  if (resume.skills && resume.skills.length > 0) {
    docContent.push(...createSectionHeader('Technical Skills', template, colorHex, sizes.heading));
    for (const cat of resume.skills) {
      docContent.push({
        text: [
          { text: `${cat.category}: `, bold: true, color: '#0F172A' },
          { text: cat.items.join(', '), color: '#334155' }
        ],
        fontSize: sizes.body,
        margin: [0, 1, 0, 2]
      });
    }
    docContent.push({ text: '', margin: [0, 0, 0, 6] });
  }

  // 4. Work Experience
  if (resume.experience && resume.experience.length > 0) {
    docContent.push(...createSectionHeader('Work Experience', template, colorHex, sizes.heading));

    for (const job of resume.experience) {
      const dateText = `${job.startDate || ''} – ${job.endDate || 'Present'}`;

      docContent.push({
        text: [
          { text: job.title, bold: true, color: '#0F172A' },
          { text: ` | ${job.company}`, italics: true, color: '#334155' },
          { text: ` (${dateText})`, color: '#64748B' }
        ],
        fontSize: sizes.body,
        margin: [0, 4, 0, 2]
      });

      if (job.highlights && job.highlights.length > 0) {
        docContent.push({
          ul: job.highlights.map((h) => ({
            text: h,
            fontSize: sizes.body,
            lineHeight: 1.2,
            color: '#1E293B'
          })),
          margin: [0, 1, 0, 6]
        });
      }
    }
  }

  // 5. Education
  if (resume.education && resume.education.length > 0) {
    docContent.push(...createSectionHeader('Education', template, colorHex, sizes.heading));

    for (const edu of resume.education) {
      docContent.push({
        text: [
          { text: edu.degree, bold: true, color: '#0F172A' },
          { text: ` | ${edu.institution}`, color: '#334155' },
          edu.endDate ? { text: ` (${edu.endDate})`, color: '#64748B' } : { text: '' }
        ],
        fontSize: sizes.body,
        margin: [0, 3, 0, 2]
      });

      if (edu.highlights && edu.highlights.length > 0) {
        docContent.push({
          ul: edu.highlights.map((h) => ({
            text: h,
            fontSize: sizes.body,
            color: '#1E293B'
          })),
          margin: [0, 1, 0, 4]
        });
      }
    }
  }

  // 6. Projects (Optional)
  if (resume.projects && resume.projects.length > 0) {
    docContent.push(...createSectionHeader('Projects', template, colorHex, sizes.heading));

    for (const proj of resume.projects) {
      docContent.push({
        text: proj.name,
        bold: true,
        fontSize: sizes.body,
        color: '#0F172A',
        margin: [0, 3, 0, 1]
      });

      if (proj.highlights && proj.highlights.length > 0) {
        docContent.push({
          ul: proj.highlights.map((h) => ({
            text: h,
            fontSize: sizes.body,
            color: '#1E293B'
          })),
          margin: [0, 1, 0, 4]
        });
      }
    }
  }

  // Document definitions
  const docDefinition: TDocumentDefinitions = {
    pageSize: 'A4',
    pageMargins: [pageMargin, pageMargin, pageMargin, pageMargin],
    defaultStyle: {
      font: defaultFont
    },
    content: docContent
  };

  const outputDoc = pdfmake.createPdf(docDefinition);
  return outputDoc.getBuffer();
}
