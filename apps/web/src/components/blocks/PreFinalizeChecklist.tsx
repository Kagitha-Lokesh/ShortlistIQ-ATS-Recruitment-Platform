import React, { useState } from 'react';
import { Dialog } from '../ui/Dialog.js';
import { Button } from '../ui/Button.js';
import { AlertCircle, CheckCircle2, ShieldCheck, UserCheck } from 'lucide-react';

export interface PreFinalizeChecklistProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  batchName: string;
  totalCandidates: number;
  shortlistedCount: number;
  unshortlistedCount: number;
  needsReviewCount: number;
  isSubmitting?: boolean;
}

export const PreFinalizeChecklist: React.FC<PreFinalizeChecklistProps> = ({
  isOpen,
  onClose,
  onConfirm,
  batchName,
  totalCandidates,
  shortlistedCount,
  unshortlistedCount,
  needsReviewCount,
  isSubmitting = false
}) => {
  const [checkedItems, setCheckedItems] = useState<{
    humanReviewConfirmed: boolean;
    overridesJustified: boolean;
    nonAutomatedWording: boolean;
  }>({
    humanReviewConfirmed: false,
    overridesJustified: false,
    nonAutomatedWording: false
  });

  const allChecked =
    checkedItems.humanReviewConfirmed &&
    checkedItems.overridesJustified &&
    checkedItems.nonAutomatedWording &&
    needsReviewCount === 0;

  const handleToggle = (key: keyof typeof checkedItems) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Pre-Finalization Human Sign-Off Checklist"
      description={`Verify algorithmic compliance for "${batchName}" before generating final decisions.`}
      maxWidth="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onConfirm}
            disabled={!allChecked || isSubmitting}
            isLoading={isSubmitting}
          >
            Confirm & Finalize Batch
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Breakdown Stats */}
        <div className="grid grid-cols-3 gap-2 p-3 rounded-lg border border-border bg-surface-subtle text-center">
          <div>
            <span className="text-[11px] text-ink-muted block">Shortlisted</span>
            <span className="text-sm font-bold text-state-success tabular-nums">{shortlistedCount}</span>
          </div>
          <div>
            <span className="text-[11px] text-ink-muted block">Needs Review</span>
            <span className="text-sm font-bold text-state-warning tabular-nums">{needsReviewCount}</span>
          </div>
          <div>
            <span className="text-[11px] text-ink-muted block">Not Shortlisted</span>
            <span className="text-sm font-bold text-ink-secondary tabular-nums">{unshortlistedCount}</span>
          </div>
        </div>

        {/* Blocking Warning if Needs Review > 0 */}
        {needsReviewCount > 0 && (
          <div className="p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-semibold block">Pending Human Review Required</span>
              <span>
                There are still {needsReviewCount} candidates marked "Needs Review". All candidates must be confirmed or overridden by an HR evaluator before the batch can be finalized.
              </span>
            </div>
          </div>
        )}

        {/* Required Sign-Off Checkboxes */}
        <div className="space-y-3 pt-2">
          <label className="flex items-start gap-3 p-3 rounded border border-border hover:bg-surface-subtle transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checkedItems.humanReviewConfirmed}
              onChange={() => handleToggle('humanReviewConfirmed')}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-semibold text-ink-primary block">
                Human-in-the-Loop Verification
              </span>
              <span className="text-ink-secondary">
                I verify that every shortlisting outcome was reviewed by an authorized hiring manager, and no candidate was rejected purely by automated means.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded border border-border hover:bg-surface-subtle transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checkedItems.overridesJustified}
              onChange={() => handleToggle('overridesJustified')}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-semibold text-ink-primary block">
                Manual Override Audit Trail
              </span>
              <span className="text-ink-secondary">
                All status changes or criteria adjustments have mandatory rationale documented for compliance and EEOC audit logging.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded border border-border hover:bg-surface-subtle transition-colors cursor-pointer select-none">
            <input
              type="checkbox"
              checked={checkedItems.nonAutomatedWording}
              onChange={() => handleToggle('nonAutomatedWording')}
              className="mt-0.5 rounded border-border text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-semibold text-ink-primary block">
                Transparent & Dignified Communication
              </span>
              <span className="text-ink-secondary">
                Email templates frame results honestly ("application not progressed at this time" rather than "rejected by AI algorithm").
              </span>
            </div>
          </label>
        </div>
      </div>
    </Dialog>
  );
};

