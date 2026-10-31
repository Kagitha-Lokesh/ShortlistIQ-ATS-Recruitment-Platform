import { z } from 'zod';
import { USER_ROLES } from '../constants/index.js';

export const UserRoleSchema = z.enum([
  USER_ROLES.HR_ADMIN,
  USER_ROLES.HR_MEMBER,
  USER_ROLES.CANDIDATE
]);

export const HealthCheckResponseSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
  service: z.string(),
  version: z.string()
});
export type HealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;

export const ApiErrorDetailSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional()
});

export const ApiErrorResponseSchema = z.object({
  success: z.literal(false),
  error: ApiErrorDetailSchema
});
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export const SignUpHRInputSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  fullName: z.string().min(2, 'Full name is required'),
  organizationName: z.string().min(2, 'Company or Organization name is required')
});
export type SignUpHRInput = z.infer<typeof SignUpHRInputSchema>;

export const SignInInputSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required')
});
export type SignInInput = z.infer<typeof SignInInputSchema>;

export const ProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  fullName: z.string().nullable(),
  role: z.enum(['hr', 'candidate']),
  orgId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Profile = z.infer<typeof ProfileSchema>;

export const OrganizationSchema = z.object({
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Organization = z.infer<typeof OrganizationSchema>;

// Phase 3 Engine & AI Schemas
export const KnockoutRuleSchema = z.object({
  type: z.enum(['missing_keyword', 'experience_below']),
  value: z.union([z.string(), z.number()]),
  reason: z.string()
});
export type KnockoutRule = z.infer<typeof KnockoutRuleSchema>;

export const ScoringCriteriaSchema = z.object({
  requiredKeywords: z.array(z.string()).default([]),
  preferredKeywords: z.array(z.string()).default([]),
  minimumYearsExperience: z.number().min(0).optional(),
  requiredEducation: z.string().optional(),
  knockoutRules: z.array(KnockoutRuleSchema).optional()
});
export type ScoringCriteria = z.infer<typeof ScoringCriteriaSchema>;

export const DeterministicBreakdownSchema = z.object({
  overallScore: z.number().min(0).max(100),
  keywordScore: z.number().min(0).max(50),
  preferredScore: z.number().min(0).max(15),
  experienceScore: z.number().min(0).max(25),
  formattingScore: z.number().min(0).max(10),
  matchedKeywords: z.array(z.string()),
  missingKeywords: z.array(z.string()),
  matchedPreferred: z.array(z.string()),
  missingPreferred: z.array(z.string()),
  detectedExperienceYears: z.number().min(0),
  experienceMatched: z.boolean(),
  knockoutTriggered: z.boolean(),
  knockoutReason: z.string().nullable()
});
export type DeterministicBreakdown = z.infer<typeof DeterministicBreakdownSchema>;

export const LlmSuggestionSchema = z.object({
  section: z.string(),
  originalText: z.string(),
  proposedText: z.string(),
  reason: z.string(),
  impact: z.string()
});
export type LlmSuggestion = z.infer<typeof LlmSuggestionSchema>;

export const CandidateSummaryResponseSchema = z.object({
  headline: z.string(),
  strengths: z.array(z.string()),
  gaps: z.array(z.string()),
  recommendedAction: z.enum(['interview', 'review', 'reject'])
});
export type CandidateSummaryResponse = z.infer<typeof CandidateSummaryResponseSchema>;

// Phase 5 Resume Data & Template Schemas
export const ContactInfoSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().or(z.literal('NO_EMAIL')),
  phone: z.string().optional().default(''),
  location: z.string().optional().default(''),
  linkedin: z.string().optional().default(''),
  github: z.string().optional().default(''),
  website: z.string().optional().default('')
});
export type ContactInfo = z.infer<typeof ContactInfoSchema>;

export const ExperienceItemSchema = z.object({
  title: z.string().min(1, 'Job title is required'),
  company: z.string().min(1, 'Company is required'),
  location: z.string().optional().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  current: z.boolean().default(false),
  highlights: z.array(z.string()).default([])
});
export type ExperienceItem = z.infer<typeof ExperienceItemSchema>;

export const EducationItemSchema = z.object({
  degree: z.string().min(1, 'Degree or field of study is required'),
  institution: z.string().min(1, 'Institution is required'),
  location: z.string().optional().default(''),
  startDate: z.string().optional().default(''),
  endDate: z.string().optional().default(''),
  gpa: z.string().optional(),
  highlights: z.array(z.string()).optional()
});
export type EducationItem = z.infer<typeof EducationItemSchema>;

export const SkillCategorySchema = z.object({
  category: z.string().default('Technical Skills'),
  items: z.array(z.string()).default([])
});
export type SkillCategory = z.infer<typeof SkillCategorySchema>;

export const ProjectItemSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional().default(''),
  technologies: z.array(z.string()).optional(),
  url: z.string().optional(),
  highlights: z.array(z.string()).default([])
});
export type ProjectItem = z.infer<typeof ProjectItemSchema>;

export const CertificationItemSchema = z.object({
  name: z.string().min(1, 'Certification name is required'),
  issuer: z.string().optional().default(''),
  date: z.string().optional().default(''),
  url: z.string().optional()
});
export type CertificationItem = z.infer<typeof CertificationItemSchema>;

export const ResumeDataSchema = z.object({
  contact: ContactInfoSchema,
  summary: z.string().default(''),
  experience: z.array(ExperienceItemSchema).default([]),
  education: z.array(EducationItemSchema).default([]),
  skills: z.array(SkillCategorySchema).default([]),
  projects: z.array(ProjectItemSchema).default([]),
  certifications: z.array(CertificationItemSchema).default([])
});
export type ResumeData = z.infer<typeof ResumeDataSchema>;

export const TemplateThemeOptionsSchema = z.object({
  template: z.enum(['classic', 'modern', 'compact', 'minimal']).default('modern'),
  accentColor: z.enum(['indigo', 'slate', 'navy', 'forest', 'charcoal']).default('indigo'),
  fontSize: z.enum(['small', 'medium', 'large']).default('medium'),
  margins: z.enum(['compact', 'normal', 'spacious']).default('normal')
});
export type TemplateThemeOptions = z.infer<typeof TemplateThemeOptionsSchema>;

// Phase 6 HR Batches & Candidates Schemas
export const CreateBatchInputSchema = z.object({
  name: z.string().min(2, 'Batch name is required'),
  jobTitle: z.string().min(2, 'Job title is required'),
  jdText: z.string().min(10, 'Job description must be at least 10 characters'),
  criteria: ScoringCriteriaSchema.optional().default({}),
  cutoff: z.number().min(0).max(100).optional().default(70),
  status: z.enum(['draft', 'active']).optional().default('active')
});
export type CreateBatchInput = z.infer<typeof CreateBatchInputSchema>;

export const UpdateBatchInputSchema = z.object({
  name: z.string().min(2).optional(),
  jobTitle: z.string().min(2).optional(),
  jdText: z.string().min(10).optional(),
  criteria: ScoringCriteriaSchema.optional(),
  cutoff: z.number().min(0).max(100).optional(),
  status: z.enum(['draft', 'active', 'closed', 'archived']).optional()
});
export type UpdateBatchInput = z.infer<typeof UpdateBatchInputSchema>;

export const UpdateCandidateInputSchema = z.object({
  fullName: z.string().min(1).optional(),
  email: z.string().email('Please enter a valid email address').optional(),
  phone: z.string().optional()
});
export type UpdateCandidateInput = z.infer<typeof UpdateCandidateInputSchema>;

// Phase 8 Application Forms & Knockout Schemas
export const FormFieldTypeSchema = z.enum([
  'text',
  'textarea',
  'select',
  'multiselect',
  'boolean',
  'number',
  'date'
]);
export type FormFieldType = z.infer<typeof FormFieldTypeSchema>;

export const FormFieldSchema = z.object({
  id: z.string().min(1, 'Field id is required'),
  label: z.string().min(1, 'Field label is required'),
  type: FormFieldTypeSchema,
  required: z.boolean().default(false),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  options: z.array(z.string()).optional(),
  isLocked: z.boolean().optional()
});
export type FormField = z.infer<typeof FormFieldSchema>;

export const LOCKED_MANDATORY_FIELDS: FormField[] = [
  {
    id: 'fullName',
    label: 'Full Name',
    type: 'text',
    required: true,
    isLocked: true,
    placeholder: 'e.g. Jane Doe'
  },
  {
    id: 'email',
    label: 'Email Address',
    type: 'text',
    required: true,
    isLocked: true,
    placeholder: 'e.g. jane.doe@example.com'
  },
  {
    id: 'phone',
    label: 'Phone Number',
    type: 'text',
    required: true,
    isLocked: true,
    placeholder: 'e.g. +1 (555) 000-0000'
  }
];

export const KnockoutOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'less_than',
  'greater_than',
  'contains',
  'excludes'
]);
export type KnockoutOperator = z.infer<typeof KnockoutOperatorSchema>;

export const FormKnockoutRuleSchema = z.object({
  id: z.string(),
  fieldId: z.string().min(1, 'Field ID is required'),
  fieldLabel: z.string().optional(),
  operator: KnockoutOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  reason: z.string().min(1, 'Knockout reason is required')
});
export type FormKnockoutRule = z.infer<typeof FormKnockoutRuleSchema>;

export const FormSchemaDefinitionSchema = z.object({
  fields: z.array(FormFieldSchema).default([]),
  consentText: z
    .string()
    .default(
      'I consent to the collection, processing and retention of my personal data and resume for recruitment purposes.'
    )
});
export type FormSchemaDefinition = z.infer<typeof FormSchemaDefinitionSchema>;

export const CreateFormInputSchema = z.object({
  batchId: z.string().uuid('Invalid batch ID'),
  title: z.string().min(2, 'Form title is required'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
  schema: FormSchemaDefinitionSchema,
  knockoutRules: z.array(FormKnockoutRuleSchema).optional().default([]),
  isPublished: z.boolean().optional().default(true)
});
export type CreateFormInput = z.infer<typeof CreateFormInputSchema>;

export const UpdateFormInputSchema = z.object({
  title: z.string().min(2).optional(),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens')
    .optional(),
  schema: FormSchemaDefinitionSchema.optional(),
  knockoutRules: z.array(FormKnockoutRuleSchema).optional(),
  isPublished: z.boolean().optional()
});
export type UpdateFormInput = z.infer<typeof UpdateFormInputSchema>;

export const PublicFormSubmissionSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Please enter a valid email address'),
  phone: z.string().min(3, 'Phone number is required'),
  answers: z.record(z.any()).default({}),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'You must consent to data processing to submit this application.' })
  }),
  honeypot: z.string().optional(),
  turnstileToken: z.string().optional()
});
export type PublicFormSubmission = z.infer<typeof PublicFormSubmissionSchema>;


