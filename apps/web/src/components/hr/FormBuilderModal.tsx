import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  FormField,
  FormFieldType,
  FormKnockoutRule,
  LOCKED_MANDATORY_FIELDS,
  KnockoutOperator
} from '@shortlistiq/shared';
import { shortlistApi } from '../../lib/api.js';
import {
  X,
  Plus,
  Trash2,
  Lock,
  GripVertical,
  AlertTriangle,
  Sparkles,
  Link as LinkIcon,
  CheckCircle2,
  Sliders,
  Type,
  AlignLeft,
  ChevronDown,
  ChevronUp,
  Calendar,
  Hash,
  ToggleLeft,
  ListPlus,
  Loader2,
  Info,
  Copy,
  Eye,
  Check,
  ShieldAlert
} from 'lucide-react';
import { Button } from '../ui/Button.js';
import { useToast } from '../../context/ToastContext.js';

interface FormBuilderModalProps {
  batchId: string;
  isOpen: boolean;
  onClose: () => void;
  formToEdit?: any | null;
  onFormSaved: () => void;
}

// Sortable item wrapper for draggable custom fields with keyboard accessible move buttons
const SortableFieldItem: React.FC<{
  field: FormField;
  index: number;
  totalFields: number;
  onDelete: (id: string) => void;
  onEdit: (field: FormField) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}> = ({ field, index, totalFields, onDelete, onEdit, onMoveUp, onMoveDown }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1
  };

  const getTypeIcon = (type: FormFieldType) => {
    switch (type) {
      case 'text':
        return <Type className="w-3.5 h-3.5 text-ink-muted" />;
      case 'textarea':
        return <AlignLeft className="w-3.5 h-3.5 text-ink-muted" />;
      case 'select':
        return <ChevronDown className="w-3.5 h-3.5 text-ink-muted" />;
      case 'multiselect':
        return <ListPlus className="w-3.5 h-3.5 text-ink-muted" />;
      case 'boolean':
        return <ToggleLeft className="w-3.5 h-3.5 text-ink-muted" />;
      case 'number':
        return <Hash className="w-3.5 h-3.5 text-ink-muted" />;
      case 'date':
        return <Calendar className="w-3.5 h-3.5 text-ink-muted" />;
      default:
        return <Type className="w-3.5 h-3.5 text-ink-muted" />;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3.5 bg-surface border border-border rounded-xl shadow-2xs hover:border-border-strong transition-colors"
    >
      <div className="flex items-center gap-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-ink-muted hover:text-ink-primary transition-colors"
          title="Drag to reorder"
          aria-label={`Drag to reorder ${field.label}`}
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="p-2 bg-surface-muted rounded-lg text-ink-secondary">{getTypeIcon(field.type)}</div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink-primary">{field.label}</span>
            {field.required && (
              <span className="text-xs text-status-danger-text font-bold" title="Required field">
                *
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-ink-muted mt-0.5">
            <span className="uppercase font-medium font-mono">{field.type}</span>
            <span>•</span>
            <span>Key: {field.id}</span>
            {field.options && field.options.length > 0 && (
              <>
                <span>•</span>
                <span>{field.options.length} options</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1">
        {/* Keyboard-accessible order buttons */}
        <button
          type="button"
          onClick={() => onMoveUp(index)}
          disabled={index === 0}
          aria-label={`Move question "${field.label}" up`}
          className="p-1 text-ink-muted hover:text-ink-primary disabled:opacity-25 disabled:pointer-events-none rounded-md transition-colors"
          title="Move up"
        >
          <ChevronUp className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMoveDown(index)}
          disabled={index === totalFields - 1}
          aria-label={`Move question "${field.label}" down`}
          className="p-1 text-ink-muted hover:text-ink-primary disabled:opacity-25 disabled:pointer-events-none rounded-md transition-colors"
          title="Move down"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => onEdit(field)}
          className="px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded-md transition-colors ml-1"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(field.id)}
          className="p-1 text-ink-muted hover:text-status-danger-text rounded-md transition-colors"
          title="Remove field"
          aria-label={`Remove field ${field.label}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export const FormBuilderModal: React.FC<FormBuilderModalProps> = ({
  batchId,
  isOpen,
  onClose,
  formToEdit,
  onFormSaved
}) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'fields' | 'knockout' | 'settings' | 'preview'>('fields');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [customFields, setCustomFields] = useState<FormField[]>([]);
  const [knockoutRules, setKnockoutRules] = useState<FormKnockoutRule[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Field editing modal state
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [fieldType, setFieldType] = useState<FormFieldType>('text');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldPlaceholder, setFieldPlaceholder] = useState('');
  const [fieldHelpText, setFieldHelpText] = useState('');
  const [fieldOptionsText, setFieldOptionsText] = useState('');

  // Sensors for dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (formToEdit) {
      setTitle(formToEdit.title || '');
      setSlug(formToEdit.slug || '');
      setIsPublished(formToEdit.isPublished ?? true);
      const schemaFields: FormField[] = formToEdit.schema?.fields || [];
      const nonLocked = schemaFields.filter((f) => !f.isLocked);
      setCustomFields(nonLocked);
      setKnockoutRules(formToEdit.knockoutRules || []);
    } else {
      setTitle('');
      setSlug('');
      setIsPublished(true);
      setCustomFields([
        {
          id: 'years_experience',
          label: 'Total Years of Professional Experience',
          type: 'number',
          required: true,
          isLocked: false
        },
        {
          id: 'willing_to_relocate',
          label: 'Are you legally authorized to work in this location?',
          type: 'boolean',
          required: true,
          isLocked: false
        }
      ]);
      setKnockoutRules([
        {
          id: `ko_${Date.now()}`,
          fieldId: 'willing_to_relocate',
          fieldLabel: 'Are you legally authorized to work in this location?',
          operator: 'equals',
          value: false,
          reason: 'Candidate does not have verified work authorization'
        }
      ]);
    }
    setErrorMsg(null);
  }, [formToEdit, isOpen]);

  if (!isOpen) return null;

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!formToEdit && (!slug || slug === title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30))) {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 35)
      );
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setCustomFields((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleAddFieldFromPalette = (type: FormFieldType) => {
    const newId = `field_${Date.now()}`;
    const newField: FormField = {
      id: newId,
      label: `New ${type.charAt(0).toUpperCase() + type.slice(1)} Question`,
      type,
      required: false,
      isLocked: false,
      options: type === 'select' || type === 'multiselect' ? ['Option 1', 'Option 2'] : undefined
    };
    setCustomFields((prev) => [...prev, newField]);
    handleOpenEditField(newField);
  };

  const handleOpenEditField = (field: FormField) => {
    setEditingField(field);
    setFieldLabel(field.label);
    setFieldId(field.id);
    setFieldType(field.type);
    setFieldRequired(field.required);
    setFieldPlaceholder(field.placeholder || '');
    setFieldHelpText(field.helpText || '');
    setFieldOptionsText(field.options ? field.options.join('\n') : '');
  };

  const handleSaveFieldEdit = () => {
    if (!editingField || !fieldLabel.trim()) return;

    let options: string[] | undefined = undefined;
    if (fieldType === 'select' || fieldType === 'multiselect') {
      options = fieldOptionsText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      if (options.length === 0) {
        options = ['Option 1', 'Option 2'];
      }
    }

    const updated: FormField = {
      ...editingField,
      label: fieldLabel.trim(),
      type: fieldType,
      required: fieldRequired,
      isLocked: false,
      placeholder: fieldPlaceholder.trim() || undefined,
      helpText: fieldHelpText.trim() || undefined,
      options
    };

    setCustomFields((prev) => {
      const exists = prev.some((f) => f.id === updated.id);
      if (exists) {
        return prev.map((f) => (f.id === updated.id ? updated : f));
      }
      return [...prev, updated];
    });

    setEditingField(null);
  };

  const handleDeleteField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
    setKnockoutRules((prev) => prev.filter((r) => r.fieldId !== id));
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= customFields.length) return;
    setCustomFields((prev) => arrayMove(prev, index, targetIndex));
  };

  const handleAddKnockoutRule = () => {
    const firstField = customFields[0];
    if (!firstField) return;

    setKnockoutRules((prev) => [
      ...prev,
      {
        id: `ko_${Date.now()}`,
        fieldId: firstField.id,
        fieldLabel: firstField.label,
        operator: 'equals',
        value: firstField.type === 'boolean' ? false : '',
        reason: 'Candidate did not meet required qualification'
      }
    ]);
  };

  const handleRemoveKnockoutRule = (id: string) => {
    setKnockoutRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleCopyPublicLink = () => {
    const url = `${window.location.origin}/apply/${slug || 'demo'}`;
    navigator.clipboard.writeText(url);
    addToast('success', 'Public application link copied to clipboard.');
  };

  const handleSaveForm = async () => {
    try {
      if (!title.trim()) {
        setErrorMsg('Form title is required.');
        return;
      }
      const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-|-$/g, '');
      if (!cleanSlug) {
        setErrorMsg('Valid URL slug is required (alphanumeric and hyphens only).');
        return;
      }

      setIsSaving(true);
      setErrorMsg(null);

      const allFields: FormField[] = [
        ...LOCKED_MANDATORY_FIELDS,
        {
          id: 'resumePdf',
          label: 'Resume (PDF format only)',
          type: 'text' as any,
          required: true,
          isLocked: true,
          helpText: 'Upload text-based PDF up to 10MB'
        },
        ...customFields
      ];

      const payload = {
        batchId,
        title: title.trim(),
        slug: cleanSlug,
        schema: {
          fields: allFields,
          consentText:
            'I consent to the collection, processing and retention of my personal data and resume for recruitment purposes.'
        },
        knockoutRules,
        isPublished
      };

      if (formToEdit) {
        await shortlistApi.updateForm(formToEdit.id, payload);
      } else {
        await shortlistApi.createForm(payload);
      }

      onFormSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save application form.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-border">
        {/* Modal Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-surface-subtle">
          <div>
            <h2 className="text-base font-bold text-ink-primary flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary" />
              {formToEdit ? 'Edit Application Form' : 'Build Custom Application Form'}
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              Customize candidate questions, configure instant knockout rules, and publish public apply URLs.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ink-muted hover:text-ink-primary hover:bg-surface-hover transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-border bg-surface px-5 pt-2">
          {[
            { id: 'fields', label: `Questions (${LOCKED_MANDATORY_FIELDS.length + 1 + customFields.length})` },
            { id: 'knockout', label: `Knockout Rules (${knockoutRules.length})` },
            { id: 'settings', label: 'Slug & Publishing' },
            { id: 'preview', label: 'Live Preview' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`pb-2.5 px-3.5 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-status-danger-text flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: Questions & Field Palette */}
          {activeTab === 'fields' && (
            <div className="space-y-6">
              {/* Field Palette Bar */}
              <div className="p-4 bg-surface-subtle border border-border rounded-xl space-y-2">
                <span className="font-bold text-ink-primary block uppercase tracking-wider text-[11px]">
                  Add Field Palette
                </span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { type: 'text', label: 'Text Input', icon: Type },
                    { type: 'textarea', label: 'Multi-line', icon: AlignLeft },
                    { type: 'select', label: 'Dropdown', icon: ChevronDown },
                    { type: 'multiselect', label: 'Multi-Select', icon: ListPlus },
                    { type: 'boolean', label: 'Yes/No Toggle', icon: ToggleLeft },
                    { type: 'number', label: 'Number', icon: Hash },
                    { type: 'date', label: 'Date', icon: Calendar }
                  ].map(({ type, label, icon: Icon }) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleAddFieldFromPalette(type as any)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-border text-ink-primary hover:border-primary hover:text-primary transition-all shadow-2xs"
                    >
                      <Icon className="w-3.5 h-3.5 text-primary" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Locked Mandatory Fields */}
              <div className="space-y-2">
                <span className="font-bold uppercase tracking-wider text-ink-muted text-[11px] block">
                  Mandatory Identity Fields (Auto-Captured)
                </span>
                <div className="space-y-2">
                  {LOCKED_MANDATORY_FIELDS.map((field) => (
                    <div
                      key={field.id}
                      className="p-3 rounded-xl border border-border bg-surface-muted/60 flex items-center justify-between text-ink-muted"
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5" />
                        <span className="font-medium text-ink-primary">{field.label}</span>
                        <span className="text-[10px] text-status-danger-text font-bold">*</span>
                      </div>
                      <span className="text-[10px] font-mono uppercase bg-surface border border-border px-2 py-0.5 rounded">
                        Mandatory
                      </span>
                    </div>
                  ))}
                  <div className="p-3 rounded-xl border border-border bg-surface-muted/60 flex items-center justify-between text-ink-muted">
                    <div className="flex items-center gap-2">
                      <Lock className="w-3.5 h-3.5" />
                      <span className="font-medium text-ink-primary">Resume Document (PDF)</span>
                      <span className="text-[10px] text-status-danger-text font-bold">*</span>
                    </div>
                    <span className="text-[10px] font-mono uppercase bg-surface border border-border px-2 py-0.5 rounded">
                      Mandatory
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom Sortable Fields */}
              <div className="space-y-3">
                <span className="font-bold uppercase tracking-wider text-ink-muted text-[11px] block">
                  Custom Screening Questions ({customFields.length})
                </span>

                {customFields.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-border rounded-xl text-ink-muted bg-surface-subtle/30">
                    No custom fields added yet. Select a field type from the palette above.
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={customFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2.5">
                        {customFields.map((field, idx) => (
                          <SortableFieldItem
                            key={field.id}
                            field={field}
                            index={idx}
                            totalFields={customFields.length}
                            onDelete={handleDeleteField}
                            onEdit={handleOpenEditField}
                            onMoveUp={(i) => handleMoveField(i, 'up')}
                            onMoveDown={(i) => handleMoveField(i, 'down')}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Knockout Rules with Strict Warning */}
          {activeTab === 'knockout' && (
            <div className="space-y-5">
              {/* Prominent Knockout Warning */}
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-3 shadow-2xs">
                <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-amber-950">
                  <span className="font-bold block text-sm">Critical Notice: Automated Knockout Rules</span>
                  <p className="leading-relaxed">
                    Candidates who fail any knockout rule are <strong>immediately classified as Unshortlisted</strong> upon submission. The engine will not recommend them, regardless of their ATS match score.
                    Use knockout rules strictly for non-negotiable legal requirements (e.g. valid work authorization, mandatory state licenses).
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="font-bold text-ink-primary">Active Knockout Criteria</h3>
                <Button size="sm" variant="outline" onClick={handleAddKnockoutRule} leftIcon={<Plus className="w-3.5 h-3.5" />}>
                  Add Knockout Rule
                </Button>
              </div>

              {knockoutRules.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border rounded-xl text-ink-muted bg-surface-subtle/30">
                  No automated knockout rules configured. Candidates will be evaluated based on deterministic match criteria.
                </div>
              ) : (
                <div className="space-y-3">
                  {knockoutRules.map((rule, rIdx) => (
                    <div key={rule.id} className="p-4 bg-surface border border-border rounded-xl space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-ink-primary">Rule #{rIdx + 1}</span>
                        <button
                          onClick={() => handleRemoveKnockoutRule(rule.id)}
                          className="p-1 text-ink-muted hover:text-status-danger-text rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                            Trigger Question
                          </label>
                          <select
                            value={rule.fieldId}
                            onChange={(e) => {
                              const found = customFields.find((f) => f.id === e.target.value);
                              setKnockoutRules((prev) =>
                                prev.map((r) =>
                                  r.id === rule.id
                                    ? {
                                        ...r,
                                        fieldId: e.target.value,
                                        fieldLabel: found?.label || e.target.value
                                      }
                                    : r
                                )
                              );
                            }}
                            className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-ink-primary"
                          >
                            {customFields.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                            Knockout If Value
                          </label>
                          <input
                            type="text"
                            value={String(rule.value)}
                            onChange={(e) => {
                              setKnockoutRules((prev) =>
                                prev.map((r) =>
                                  r.id === rule.id
                                    ? { ...r, value: e.target.value === 'false' ? false : e.target.value === 'true' ? true : e.target.value }
                                    : r
                                )
                              );
                            }}
                            placeholder="false or expected value"
                            className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-ink-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-ink-secondary mb-1">
                            Disqualification Reason
                          </label>
                          <input
                            type="text"
                            value={rule.reason || ''}
                            onChange={(e) => {
                              setKnockoutRules((prev) =>
                                prev.map((r) =>
                                  r.id === rule.id ? { ...r, reason: e.target.value } : r
                                )
                              );
                            }}
                            placeholder="e.g. Lacks required license"
                            className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-ink-primary"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Slug & Settings */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-ink-primary mb-1">
                  Public Form Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Senior Backend Engineer Application"
                  className="w-full text-xs p-2.5 rounded-lg border border-border bg-surface text-ink-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-primary mb-1">
                  Public URL Slug *
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center border border-border rounded-lg bg-surface px-3 py-2 text-xs">
                    <span className="text-ink-muted mr-1 font-mono">/apply/</span>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="senior-backend-engineer"
                      className="w-full bg-transparent focus:outline-none text-ink-primary font-mono text-xs"
                    />
                  </div>
                  <Button size="sm" variant="outline" onClick={handleCopyPublicLink} leftIcon={<Copy className="w-3.5 h-3.5" />}>
                    Copy Link
                  </Button>
                </div>
              </div>

              <div className="p-4 bg-surface-subtle border border-border rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-semibold text-ink-primary block">Accepting Applications</span>
                  <span className="text-[11px] text-ink-secondary">
                    When enabled, candidates can access this public link and submit applications.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                  className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* TAB 4: Live Preview */}
          {activeTab === 'preview' && (
            <div className="p-6 bg-surface-muted border border-border rounded-xl space-y-5 max-w-xl mx-auto shadow-inner">
              <div className="text-center space-y-1 pb-4 border-b border-border">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Candidate Live Preview</span>
                <h3 className="text-base font-bold text-ink-primary">{title || 'Job Application'}</h3>
                <p className="text-xs text-ink-secondary">Single-column accessible candidate submission form</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-ink-primary mb-1">Full Name *</label>
                  <input disabled placeholder="Jane Doe" className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-ink-muted cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-primary mb-1">Email Address *</label>
                  <input disabled placeholder="jane.doe@example.com" className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-ink-muted cursor-not-allowed" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-primary mb-1">Resume Document (PDF) *</label>
                  <div className="border border-dashed border-border rounded-lg p-4 text-center text-ink-muted text-xs bg-surface">
                    Drop PDF resume here
                  </div>
                </div>

                {customFields.map((f) => (
                  <div key={f.id}>
                    <label className="block text-xs font-medium text-ink-primary mb-1">
                      {f.label} {f.required && <span className="text-status-danger-text">*</span>}
                    </label>
                    <input disabled placeholder={f.placeholder || 'Your answer'} className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-ink-muted cursor-not-allowed" />
                  </div>
                ))}

                <div className="pt-2">
                  <Button disabled variant="primary" className="w-full">
                    Submit Application
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-surface-subtle flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>

          <Button variant="primary" size="sm" onClick={handleSaveForm} isLoading={isSaving} leftIcon={<Check className="w-3.5 h-3.5" />}>
            Save Application Form
          </Button>
        </div>
      </div>

      {/* Inline Field Editor Modal */}
      {editingField && (
        <div className="fixed inset-0 z-60 bg-slate-950/40 flex items-center justify-center p-4">
          <div className="bg-surface rounded-xl shadow-xl border border-border max-w-md w-full p-5 space-y-4">
            <h3 className="text-sm font-bold text-ink-primary">Configure Question</h3>

            <div>
              <label className="block text-xs font-medium text-ink-primary mb-1">Question Label *</label>
              <input
                type="text"
                value={fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-ink-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-ink-primary mb-1">Field Type</label>
              <select
                value={fieldType}
                onChange={(e) => setFieldType(e.target.value as any)}
                className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-ink-primary"
              >
                <option value="text">Single-line Text</option>
                <option value="textarea">Multi-line Text</option>
                <option value="select">Dropdown Select</option>
                <option value="multiselect">Multi-Select</option>
                <option value="boolean">Yes/No Boolean</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
              </select>
            </div>

            {(fieldType === 'select' || fieldType === 'multiselect') && (
              <div>
                <label className="block text-xs font-medium text-ink-primary mb-1">
                  Options (one per line)
                </label>
                <textarea
                  rows={3}
                  value={fieldOptionsText}
                  onChange={(e) => setFieldOptionsText(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg border border-border bg-surface text-ink-primary font-mono"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reqCheck"
                checked={fieldRequired}
                onChange={(e) => setFieldRequired(e.target.checked)}
                className="rounded text-primary focus:ring-primary cursor-pointer"
              />
              <label htmlFor="reqCheck" className="text-xs text-ink-primary font-medium cursor-pointer">
                Required response
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button size="sm" variant="outline" onClick={() => setEditingField(null)}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={handleSaveFieldEdit}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
