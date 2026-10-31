import React from 'react';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import { Badge } from '../ui/Badge.js';
import { Plus, Trash2, ArrowUp, ArrowDown, ShieldAlert } from 'lucide-react';

export interface CriterionRule {
  id: string;
  label: string;
  type: 'must_have' | 'nice_to_have' | 'dealbreaker';
  weight?: number;
}

export interface CriteriaBuilderProps {
  criteria: CriterionRule[];
  onChange: (criteria: CriterionRule[]) => void;
  className?: string;
}

export const CriteriaBuilder: React.FC<CriteriaBuilderProps> = ({
  criteria,
  onChange,
  className = ''
}) => {
  const handleAddCriterion = (type: CriterionRule['type'] = 'must_have') => {
    const newItem: CriterionRule = {
      id: `crit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label: '',
      type,
      weight: type === 'must_have' ? 2 : type === 'dealbreaker' ? 3 : 1
    };
    onChange([...criteria, newItem]);
  };

  const handleUpdate = (id: string, updates: Partial<CriterionRule>) => {
    onChange(
      criteria.map((c) => (c.id === id ? { ...c, ...updates } : c))
    );
  };

  const handleRemove = (id: string) => {
    onChange(criteria.filter((c) => c.id !== id));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= criteria.length) return;
    const reordered = [...criteria];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex];
    reordered[targetIndex] = temp;
    onChange(reordered);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div>
          <h4 className="text-xs font-semibold text-ink-primary">Screening Criteria Rules</h4>
          <p className="text-[11px] text-ink-muted">
            Configure required competencies, preferred skills, and dealbreaker knockout filters.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddCriterion('must_have')}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
          >
            Add Must-Have
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAddCriterion('dealbreaker')}
            leftIcon={<ShieldAlert className="w-3.5 h-3.5 text-state-danger" />}
          >
            Add Dealbreaker
          </Button>
        </div>
      </div>

      {criteria.length === 0 ? (
        <div className="p-8 text-center border-2 border-dashed border-border rounded-lg bg-surface-subtle/30 text-xs text-ink-muted">
          No criteria defined yet. Click "Add Must-Have" to define requirements.
        </div>
      ) : (
        <ul className="space-y-2">
          {criteria.map((item, index) => {
            return (
              <li
                key={item.id}
                className="p-3 bg-surface border border-border rounded-md shadow-subtle flex flex-col sm:flex-row sm:items-center gap-3 transition-colors hover:border-border-strong"
              >
                {/* Reorder Buttons (Accessible, non-drag) */}
                <div className="flex sm:flex-col items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    aria-label={`Move criterion ${index + 1} up`}
                    className="p-1 text-ink-muted hover:text-ink-primary disabled:opacity-30 rounded hover:bg-surface-subtle transition-colors"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === criteria.length - 1}
                    aria-label={`Move criterion ${index + 1} down`}
                    className="p-1 text-ink-muted hover:text-ink-primary disabled:opacity-30 rounded hover:bg-surface-subtle transition-colors"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Criterion Input */}
                <div className="flex-1 min-w-0">
                  <Input
                    placeholder="e.g. 3+ years experience with React and TypeScript..."
                    value={item.label}
                    onChange={(e) => handleUpdate(item.id, { label: e.target.value })}
                  />
                </div>

                {/* Type Selector */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <select
                    value={item.type}
                    onChange={(e) => handleUpdate(item.id, { type: e.target.value as any })}
                    aria-label="Criterion type"
                    className="rounded border border-border bg-surface px-2.5 py-1.5 text-xs text-ink-primary font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
                  >
                    <option value="must_have">Must-Have (Required)</option>
                    <option value="nice_to_have">Nice-to-Have (Bonus)</option>
                    <option value="dealbreaker">Dealbreaker (Knockout)</option>
                  </select>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemove(item.id)}
                    aria-label={`Remove criterion ${item.label || index + 1}`}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
