import React, { useState } from 'react';
import {
  Button,
  Badge,
  DecisionStatusBadge,
  ParseQualityBadge,
  Input,
  Textarea,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Dialog,
  Drawer,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent
} from '../../components/ui/index.js';
import {
  KPICard,
  DataTable,
  FileDropzone,
  Stepper,
  EmptyState,
  MatchScoreMeter,
  EvidenceCard,
  CriteriaBuilder,
  BlindReviewBar,
  PreFinalizeChecklist,
  AppNavbar,
  HeroRestrained
} from '../../components/blocks/index.js';
import {
  Users,
  Briefcase,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  Search,
  Sliders,
  FileText
} from 'lucide-react';

export const ComponentShowcasePage: React.FC = () => {
  // Modal & Drawer State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);

  // Stepper State
  const [activeStep, setActiveStep] = useState(1);

  // Blind Review State
  const [isBlindReview, setIsBlindReview] = useState(true);

  // Criteria Builder State
  const [criteria, setCriteria] = useState([
    { id: '1', label: '3+ years experience with React and TypeScript', type: 'must_have' as const },
    { id: '2', label: 'PostgreSQL database indexing & query tuning', type: 'nice_to_have' as const },
    { id: '3', label: 'Active authorized work permit in country of employment', type: 'dealbreaker' as const }
  ]);

  // Tabs state
  const [activeTab, setActiveTab] = useState('blocks');

  // File dropzone test state
  const [mockFile, setMockFile] = useState<File | null>(null);

  // Table test state
  interface MockCandidate {
    id: string;
    name: string;
    role: string;
    score: number;
    decision: string;
    parseStatus: string;
  }

  const mockCandidates: MockCandidate[] = [
    { id: 'c1', name: 'Devon Vance', role: 'Full Stack Engineer', score: 94, decision: 'recommended_shortlist', parseStatus: 'OK' },
    { id: 'c2', name: 'Amara Chen', role: 'Frontend Specialist', score: 88, decision: 'recommended_shortlist', parseStatus: 'OK' },
    { id: 'c3', name: 'Marcus Sterling', role: 'Backend Lead', score: 68, decision: 'needs_review', parseStatus: 'PARTIAL' },
    { id: 'c4', name: 'Elena Rostova', role: 'DevOps / SRE', score: 52, decision: 'recommended_not_shortlisted', parseStatus: 'OK' },
    { id: 'c5', name: 'Tariq Al-Mansoor', role: 'AI Engineer', score: 38, decision: 'failed', parseStatus: 'UNREADABLE' }
  ];

  const [selectedCandidates, setSelectedCandidates] = useState<string[]>(['c1']);

  return (
    <div className="min-h-screen bg-ground text-ink-primary pb-20">
      {/* Dev Header */}
      <AppNavbar
        breadcrumbs={[
          { label: 'Developer Hub', href: '/dev/showcase' },
          { label: 'Component & Token Showcase' }
        ]}
        actions={
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
            INTERNAL DEV ROUTE
          </span>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-12">
        {/* Showcase Header */}
        <div className="border-b border-border pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-ink-primary">
            Design System & Component Showcase
          </h1>
          <p className="text-xs text-ink-secondary mt-1 max-w-2xl">
            Live review harness validating the 12 21st.dev/shadcn adapted blocks, UI primitives, and the Achromatic Ledger token architecture across light-theme states.
          </p>
        </div>

        {/* Mode Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="blocks" icon={<Sliders className="w-3.5 h-3.5" />}>
              Adapted Blocks (12 Items)
            </TabsTrigger>
            <TabsTrigger value="primitives" icon={<Briefcase className="w-3.5 h-3.5" />}>
              Base UI Primitives
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Adapted Blocks */}
          <TabsContent value="blocks" className="space-y-12">
            {/* 1. Restrained Hero */}
            <section className="space-y-3">
              <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">
                01 • HeroRestrained (Public Landing)
              </span>
              <div className="border border-border rounded-lg bg-surface shadow-subtle overflow-hidden">
                <HeroRestrained />
              </div>
            </section>

            {/* 2. KPI Cards */}
            <section className="space-y-3">
              <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">
                02 • KPICard (HR Dashboard & Results)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KPICard
                  title="Total Resumes Processed"
                  value="1,428"
                  delta={{ value: "+14%", isPositive: true, label: "vs prior batch" }}
                  icon={<Users className="w-4 h-4" />}
                />
                <KPICard
                  title="Recommended Shortlist"
                  value="182"
                  delta={{ value: "12.7%", label: "shortlist rate" }}
                  icon={<CheckCircle2 className="w-4 h-4 text-state-success" />}
                />
                <KPICard
                  title="Pending Human Review"
                  value="24"
                  delta={{ value: "Action required", isPositive: false }}
                  icon={<AlertTriangle className="w-4 h-4 text-state-warning" />}
                />
                <KPICard
                  title="Average Parse Quality"
                  value="98.4%"
                  isLoading={false}
                  subtext="Positional coordinate extraction verified"
                />
              </div>
            </section>

            {/* 3. Match Score Meter */}
            <section className="space-y-3">
              <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">
                03 • MatchScoreMeter (Scoring Transparency)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-5 border border-border rounded-lg bg-surface shadow-subtle">
                <MatchScoreMeter score={94} />
                <MatchScoreMeter score={68} />
                <MatchScoreMeter score={42} />
              </div>
            </section>

            {/* 4. Blind Review Bar */}
            <section className="space-y-3">
              <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">
                04 • BlindReviewBar (Integrity & Bias Protection)
              </span>
              <BlindReviewBar
                isBlindReview={isBlindReview}
                onToggleBlindReview={setIsBlindReview}
              />
            </section>

            {/* 5. Stepper */}
            <section className="space-y-3">
              <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">
                05 • Stepper (Batch Creation & Wizard Flows)
              </span>
              <div className="p-6 border border-border rounded-lg bg-surface shadow-subtle">
                <Stepper
                  steps={[
                    { id: 'upload', title: 'Upload Resumes', description: 'PDF or DOCX batches' },
                    { id: 'criteria', title: 'Define Criteria', description: 'Must-haves & knockouts' },
                    { id: 'review', title: 'Human Screening', description: 'Verbatim evidence audit' },
                    { id: 'finalize', title: 'Dispatch Decision', description: 'Transparent notification' }
                  ]}
                  currentStepIndex={activeStep}
                  onStepClick={setActiveStep}
                />
                <div className="mt-4 flex items-center justify-between text-xs text-ink-muted pt-4 border-t border-border">
                  <span>Click step milestones to test navigation state</span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
                      disabled={activeStep === 0}
                    >
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveStep((s) => Math.min(3, s + 1))}
                      disabled={activeStep === 3}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            {/* 6. File Dropzone */}
            <section className="space-y-3">
              <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">
                06 • FileDropzone (Ingestion & Uploads)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FileDropzone
                  onFileSelect={(file) => setMockFile(file)}
                  selectedFile={mockFile}
                  onClearFile={() => setMockFile(null)}
                />
                <FileDropzone
                  onFileSelect={() => {}}
                  isLoading={true}
                  progress={65}
                  selectedFile={new File([''], 'Lokesh_Kagitha_Resume.pdf', { type: 'application/pdf' })}
                />
              </div>
            </section>

            {/* 7. Evidence Card */}
            <section className="space-y-3">
              <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">
                07 • EvidenceCard (Verbatim Grounding & Audit)
              </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EvidenceCard
                  evidence={{
                    id: 'ev-1',
                    criterionTitle: 'React & TypeScript Architecture',
                    criterionType: 'must_have',
                    jdSnippet: 'Minimum 3+ years building high-throughput React & TypeScript web applications.',
                    resumeSnippet: 'Architected enterprise HRM dashboard utilizing React, Node.js, and TypeScript with role-based access control.',
                    matchType: 'direct',
                    pageNumber: 1
                  }}
                  onViewInPdf={(page) => alert(`Navigating to PDF Page ${page}`)}
                />
                <EvidenceCard
                  evidence={{
                    id: 'ev-2',
                    criterionTitle: 'Cloud Deployment (AWS / GCP)',
                    criterionType: 'nice_to_have',
                    jdSnippet: 'Hands-on experience deploying containerized microservices to AWS or Google Cloud.',
                    resumeSnippet: null,
                    matchType: 'missing'
                  }}
                />
              </div>
            </section>

            {/* 8. Criteria Builder */}
            <section className="space-y-3">
              <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">
                08 • CriteriaBuilder (Knockout & Weighting Rules)
              </span>
              <div className="p-5 border border-border rounded-lg bg-surface shadow-subtle">
                <CriteriaBuilder criteria={criteria} onChange={setCriteria} />
              </div>
            </section>

            {/* 9. Data Table */}
            <section className="space-y-3">
              <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">
                09 • DataTable (Achromatic Ledger Records)
              </span>
              <DataTable
                data={mockCandidates}
                keyExtractor={(c) => c.id}
                searchableKey="name"
                searchPlaceholder="Search candidates by name…"
                selectedIds={selectedCandidates}
                onSelectionChange={setSelectedCandidates}
                columns={[
                  { key: 'name', header: 'Candidate Name', sortable: true },
                  { key: 'role', header: 'Applied Role' },
                  {
                    key: 'score',
                    header: 'Match Score',
                    sortable: true,
                    align: 'right',
                    cell: (c) => (
                      <span className="font-bold tabular-nums">
                        {c.score} <span className="text-ink-muted text-[10px]">/ 100</span>
                      </span>
                    )
                  },
                  {
                    key: 'decision',
                    header: 'Recommendation',
                    cell: (c) => <DecisionStatusBadge decision={c.decision} size="sm" />
                  },
                  {
                    key: 'parseStatus',
                    header: 'Parse Quality',
                    cell: (c) => <ParseQualityBadge status={c.parseStatus} size="sm" />
                  }
                ]}
              />
            </section>

            {/* 10. Empty State */}
            <section className="space-y-3">
              <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">
                10 • EmptyState (Zero Data Resilience)
              </span>
              <EmptyState
                icon={<FolderOpen className="w-6 h-6" />}
                title="No Screening Batches Created Yet"
                description="Upload resumes in bulk or create an applicant submission form to start evaluating candidates."
                actionText="Create New Screening Batch"
                onAction={() => alert('Action clicked')}
                secondaryActionText="Import via CSV"
                onSecondaryAction={() => alert('Secondary clicked')}
              />
            </section>

            {/* 11 & 12. Modal & Drawer Triggers */}
            <section className="space-y-3">
              <span className="text-xs font-mono text-ink-muted uppercase tracking-wider">
                11 & 12 • PreFinalizeChecklist Modal & Slide-in Drawer
              </span>
              <div className="p-6 border border-border rounded-lg bg-surface shadow-subtle flex flex-wrap gap-4 items-center">
                <Button
                  variant="primary"
                  onClick={() => setIsChecklistOpen(true)}
                >
                  Open Pre-Finalization Checklist Modal
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDrawerOpen(true)}
                >
                  Open Candidate Slide-In Drawer
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsDialogOpen(true)}
                >
                  Open Standard Dialog
                </Button>
              </div>
            </section>
          </TabsContent>

          {/* TAB 2: UI Primitives */}
          <TabsContent value="primitives" className="space-y-8">
            {/* Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Button Primitives</CardTitle>
                <CardDescription>Semantic button hierarchy across light-theme roles</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary">Primary Action</Button>
                  <Button variant="secondary">Secondary Action</Button>
                  <Button variant="outline">Outline Action</Button>
                  <Button variant="ghost">Ghost Action</Button>
                  <Button variant="danger">Danger Action</Button>
                  <Button variant="success">Success Action</Button>
                  <Button variant="primary" isLoading={true}>Loading State</Button>
                  <Button variant="primary" disabled={true}>Disabled State</Button>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm">Small Size (sm)</Button>
                  <Button size="md">Medium Size (md)</Button>
                  <Button size="lg">Large Size (lg)</Button>
                </div>
              </CardContent>
            </Card>

            {/* Badges */}
            <Card>
              <CardHeader>
                <CardTitle>Decision & Status Badges</CardTitle>
                <CardDescription>Mandatory icon + text indicators for recruitment transparency</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <DecisionStatusBadge decision="recommended_shortlist" />
                  <DecisionStatusBadge decision="needs_review" />
                  <DecisionStatusBadge decision="recommended_not_shortlisted" />
                  <DecisionStatusBadge decision="failed" />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <ParseQualityBadge status="OK" />
                  <ParseQualityBadge status="PARTIAL" />
                  <ParseQualityBadge status="UNREADABLE" />
                </div>
              </CardContent>
            </Card>

            {/* Form Inputs */}
            <Card>
              <CardHeader>
                <CardTitle>Form Input Primitives</CardTitle>
                <CardDescription>Accessible inputs with validation and icon slots</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-w-lg">
                <div>
                  <Label required>Candidate Full Name</Label>
                  <Input placeholder="e.g. Sarah Connor" />
                </div>
                <div>
                  <Label>Search with Left Icon</Label>
                  <Input placeholder="Filter by skills or keyword…" leftIcon={<Search className="w-3.5 h-3.5" />} />
                </div>
                <div>
                  <Label>Error Validation State</Label>
                  <Input placeholder="Invalid input" error="A valid email address is required for screening notifications." />
                </div>
                <div>
                  <Label>Multi-line Job Description</Label>
                  <Textarea rows={3} placeholder="Paste requirements or qualifications here…" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals & Drawers */}
      <PreFinalizeChecklist
        isOpen={isChecklistOpen}
        onClose={() => setIsChecklistOpen(false)}
        onConfirm={() => {
          setIsChecklistOpen(false);
          alert('Batch finalized successfully!');
        }}
        batchName="Q4 Senior Frontend Batch"
        totalCandidates={5}
        shortlistedCount={2}
        unshortlistedCount={3}
        needsReviewCount={0}
      />

      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title="Example Modal Dialog"
        description="A standard tokenized dialog with accessible keyboard focus trap and backdrop."
      >
        <p className="leading-relaxed">
          This dialog uses the standard token classes with zero decorative glassmorphism or animations. Press Escape or click the backdrop to dismiss.
        </p>
      </Dialog>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Candidate Evidence Inspection"
        subtitle="ID: c1 • Devon Vance (Senior Full Stack Engineer)"
      >
        <div className="space-y-4">
          <MatchScoreMeter score={94} />
          <EvidenceCard
            evidence={{
              id: 'ev-drawer',
              criterionTitle: 'React & TypeScript Architecture',
              criterionType: 'must_have',
              jdSnippet: '3+ years building high-performance web applications.',
              resumeSnippet: 'Architected enterprise HRM dashboard utilizing React and TypeScript.',
              matchType: 'direct',
              pageNumber: 1
            }}
          />
        </div>
      </Drawer>
    </div>
  );
};

