import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Packer,
  convertInchesToTwip
} from 'docx';
import { ResumeData, TemplateThemeOptions } from '@shortlistiq/shared';

const ACCENT_COLORS: Record<string, string> = {
  indigo: '3730A3',
  slate: '334155',
  navy: '1E3A8A',
  forest: '166534',
  charcoal: '18181B'
};

const FONT_SIZES_HALF_PTS: Record<string, { body: number; heading: number; title: number }> = {
  small: { body: 18, heading: 22, title: 36 },    // 9pt, 11pt, 18pt
  medium: { body: 21, heading: 25, title: 40 },   // 10.5pt, 12.5pt, 20pt
  large: { body: 24, heading: 28, title: 44 }     // 12pt, 14pt, 22pt
};

const MARGIN_TWIP: Record<string, number> = {
  compact: convertInchesToTwip(0.5),
  normal: convertInchesToTwip(0.75),
  spacious: convertInchesToTwip(1.0)
};

/**
 * Creates ATS-compliant standard heading paragraph for DOCX
 */
function createDocxHeading(title: string, colorHex: string, sizes: { heading: number }) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 80 },
    children: [
      new TextRun({
        text: title.toUpperCase(),
        bold: true,
        color: colorHex,
        size: sizes.heading,
        font: 'Helvetica'
      })
    ]
  });
}

/**
 * Generates ATS-compliant native .docx resume
 */
export async function generateResumeDocx(
  resume: ResumeData,
  options: Partial<TemplateThemeOptions> = {}
): Promise<Buffer> {
  const {
    accentColor = 'indigo',
    fontSize = 'medium',
    margins = 'normal'
  } = options;

  const colorHex = ACCENT_COLORS[accentColor] || ACCENT_COLORS.indigo;
  const sizes = FONT_SIZES_HALF_PTS[fontSize] || FONT_SIZES_HALF_PTS.medium;
  const marginTwip = MARGIN_TWIP[margins] || MARGIN_TWIP.normal;

  const paragraphs: Paragraph[] = [];

  // 1. Candidate Full Name
  paragraphs.push(
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: resume.contact.fullName || 'Candidate Name',
          bold: true,
          size: sizes.title,
          color: '0F172A',
          font: 'Helvetica'
        })
      ]
    })
  );

  // Contact line
  const contactParts: string[] = [];
  if (resume.contact.email && resume.contact.email !== 'NO_EMAIL') contactParts.push(resume.contact.email);
  if (resume.contact.phone) contactParts.push(resume.contact.phone);
  if (resume.contact.location) contactParts.push(resume.contact.location);
  if (resume.contact.linkedin) contactParts.push(resume.contact.linkedin);
  if (resume.contact.github) contactParts.push(resume.contact.github);

  if (contactParts.length > 0) {
    paragraphs.push(
      new Paragraph({
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: contactParts.join('  •  '),
            size: sizes.body - 2,
            color: '475569',
            font: 'Helvetica'
          })
        ]
      })
    );
  }

  // 2. Professional Summary
  if (resume.summary && resume.summary.trim().length > 0) {
    paragraphs.push(createDocxHeading('Professional Summary', colorHex, sizes));
    paragraphs.push(
      new Paragraph({
        spacing: { after: 140 },
        children: [
          new TextRun({
            text: resume.summary.trim(),
            size: sizes.body,
            color: '1E293B',
            font: 'Helvetica'
          })
        ]
      })
    );
  }

  // 3. Technical Skills
  if (resume.skills && resume.skills.length > 0) {
    paragraphs.push(createDocxHeading('Technical Skills', colorHex, sizes));
    for (const cat of resume.skills) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [
            new TextRun({
              text: `${cat.category}: `,
              bold: true,
              size: sizes.body,
              color: '0F172A',
              font: 'Helvetica'
            }),
            new TextRun({
              text: cat.items.join(', '),
              size: sizes.body,
              color: '334155',
              font: 'Helvetica'
            })
          ]
        })
      );
    }
  }

  // 4. Work Experience
  if (resume.experience && resume.experience.length > 0) {
    paragraphs.push(createDocxHeading('Work Experience', colorHex, sizes));

    for (const job of resume.experience) {
      const dateText = `${job.startDate || ''} – ${job.endDate || 'Present'}`;

      paragraphs.push(
        new Paragraph({
          spacing: { before: 100, after: 40 },
          children: [
            new TextRun({
              text: job.title,
              bold: true,
              size: sizes.body,
              color: '0F172A',
              font: 'Helvetica'
            }),
            new TextRun({
              text: ` | ${job.company}`,
              italics: true,
              size: sizes.body,
              color: '334155',
              font: 'Helvetica'
            }),
            new TextRun({
              text: ` (${dateText})`,
              size: sizes.body,
              color: '64748B',
              font: 'Helvetica'
            })
          ]
        })
      );

      if (job.highlights && job.highlights.length > 0) {
        for (const h of job.highlights) {
          paragraphs.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 40 },
              children: [
                new TextRun({
                  text: h,
                  size: sizes.body,
                  color: '1E293B',
                  font: 'Helvetica'
                })
              ]
            })
          );
        }
      }
    }
  }

  // 5. Education
  if (resume.education && resume.education.length > 0) {
    paragraphs.push(createDocxHeading('Education', colorHex, sizes));

    for (const edu of resume.education) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({
              text: edu.degree,
              bold: true,
              size: sizes.body,
              color: '0F172A',
              font: 'Helvetica'
            }),
            new TextRun({
              text: ` | ${edu.institution}`,
              size: sizes.body,
              color: '334155',
              font: 'Helvetica'
            }),
            edu.endDate
              ? new TextRun({
                  text: ` (${edu.endDate})`,
                  size: sizes.body,
                  color: '64748B',
                  font: 'Helvetica'
                })
              : new TextRun({ text: '' })
          ]
        })
      );

      if (edu.highlights && edu.highlights.length > 0) {
        for (const h of edu.highlights) {
          paragraphs.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 30 },
              children: [
                new TextRun({
                  text: h,
                  size: sizes.body,
                  color: '1E293B',
                  font: 'Helvetica'
                })
              ]
            })
          );
        }
      }
    }
  }

  // 6. Projects (Optional)
  if (resume.projects && resume.projects.length > 0) {
    paragraphs.push(createDocxHeading('Projects', colorHex, sizes));

    for (const proj of resume.projects) {
      paragraphs.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({
              text: proj.name,
              bold: true,
              size: sizes.body,
              color: '0F172A',
              font: 'Helvetica'
            })
          ]
        })
      );

      if (proj.highlights && proj.highlights.length > 0) {
        for (const h of proj.highlights) {
          paragraphs.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { after: 30 },
              children: [
                new TextRun({
                  text: h,
                  size: sizes.body,
                  color: '1E293B',
                  font: 'Helvetica'
                })
              ]
            })
          );
        }
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: marginTwip,
              bottom: marginTwip,
              left: marginTwip,
              right: marginTwip
            }
          }
        },
        children: paragraphs
      }
    ]
  });

  return Packer.toBuffer(doc);
}

