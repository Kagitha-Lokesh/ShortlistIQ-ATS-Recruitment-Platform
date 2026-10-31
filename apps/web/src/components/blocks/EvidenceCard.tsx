import React from 'react';
import { Card, CardContent } from '../ui/Card.js';
import { Badge } from '../ui/Badge.js';
import { CheckCircle2, AlertTriangle, HelpCircle, FileText, ExternalLink } from 'lucide-react';

export interface EvidenceItem {
  id: string;
  criterionTitle: string;
  criterionType: 'must_have' | 'nice_to_have' | 'dealbreaker';
  jdSnippet: string;
  resumeSnippet?: string | null;
  matchType: 'direct' | 'related' | 'missing' | 'inferred';
  pageNumber?: number;
  integrityFlag?: string | null;
}

export interface EvidenceCardProps {
  evidence: EvidenceItem;
  onViewInPdf?: (pageNumber: number) => void;
  className?: string;
}

export const EvidenceCard: React.FC<EvidenceCardProps> = ({
  evidence,
  onViewInPdf,
  className = ''
}) => {
  const matchBadges = {
    direct: (
      <Badge variant="shortlisted" size="sm">
        <CheckCircle2 className="w-3 h-3" />
        <span>Direct Evidence</span>
      </Badge>
    ),
    related: (
      <Badge variant="neutral" size="sm">
        <HelpCircle className="w-3 h-3" />
        <span>Related Context</span>
      </Badge>
    ),
    inferred: (
      <Badge variant="needs_review" size="sm">
        <HelpCircle className="w-3 h-3" />
        <span>Inferred / Partial</span>
      </Badge>
    ),
    missing: (
      <Badge variant="unshortlisted" size="sm">
        <AlertTriangle className="w-3 h-3" />
        <span>Requirement Missing</span>
      </Badge>
    )
  };

  const typeBadges = {
    must_have: <Badge variant="must_have" size="sm">Must-Have</Badge>,
    nice_to_have: <Badge variant="nice_to_have" size="sm">Nice-to-Have</Badge>,
    dealbreaker: <Badge variant="dealbreaker" size="sm">Dealbreaker Knockout</Badge>
  };

  return (
    <Card className={`overflow-hidden transition-colors hover:border-border-strong ${className}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-ink-primary">{evidence.criterionTitle}</h4>
            {typeBadges[evidence.criterionType]}
          </div>
          <div>{matchBadges[evidence.matchType]}</div>
        </div>

        {/* Verbatim JD Requirement */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider block">
            Job Description Requirement
          </span>
          <p className="text-xs text-ink-secondary bg-surface-subtle p-2.5 rounded border border-border italic leading-relaxed">
            "{evidence.jdSnippet}"
          </p>
        </div>

        {/* Verbatim Resume Evidence */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
              Exact Resume Quote
            </span>
            {evidence.pageNumber != null && onViewInPdf && (
              <button
                type="button"
                onClick={() => onViewInPdf(evidence.pageNumber!)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
              >
                <FileText className="w-3 h-3" />
                <span>Page {evidence.pageNumber}</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </button>
            )}
          </div>

          {evidence.resumeSnippet ? (
            <p className="text-xs font-mono text-ink-primary bg-emerald-50/40 p-2.5 rounded border border-emerald-200/60 leading-relaxed break-words">
              {evidence.resumeSnippet}
            </p>
          ) : (
            <p className="text-xs text-ink-muted bg-surface-subtle p-2.5 rounded border border-border/60 italic">
              No matching keywords or experience found in candidate document.
            </p>
          )}
        </div>

        {/* Integrity Notice */}
        {evidence.integrityFlag && (
          <div className="mt-2 flex items-center gap-2 px-2.5 py-1.5 rounded bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-amber-700" />
            <span>Integrity Alert: {evidence.integrityFlag}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
