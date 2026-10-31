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
  Calendar,
  Hash,
  ToggleLeft,
  ListPlus,
  Loader2,
  Info
} from 'lucide-react';

interface FormBuilderModalProps {
  batchId: string;
  isOpen: boolean;
  onClose: () => void;
  formToEdit?: any | null;
  onFormSaved: () => void;
}

// Sortable item wrapper for draggable custom fields
const SortableFieldItem: React.FC<{
  field: FormField;
  onDelete: (id: string) => void;
  onEdit: (field: FormField) => void;
}> = ({ field, onDelete, onEdit }) => {
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
        return <Type className="w-3.5 h-3.5 text-slate-500" />;
      case 'textarea':
        return <AlignLeft className="w-3.5 h-3.5 text-slate-500" />;
      case 'select':
        return <ChevronDown className="w-3.5 h-3.5 text-slate-500" />;
      case 'multiselect':
        return <ListPlus className="w-3.5 h-3.5 text-slate-500" />;
      case 'boolean':
        return <ToggleLeft className="w-3.5 h-3.5 text-slate-500" />;
      case 'number':
        return <Hash className="w-3.5 h-3.5 text-slate-500" />;
      case 'date':
        return <Calendar className="w-3.5 h-3.5 text-slate-500" />;
      default:
        return <Type className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-md shadow-xs hover:border-slate-300 transition-colors"
    >
      <div className="flex items-center gap-3">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-600 transition-colors"
          title="Drag to reorder"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="p-1.5 bg-slate-100 rounded text-slate-600">{getTypeIcon(field.type)}</div>

        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-800">{field.label}</span>
            {field.required && (
              <span className="text-xs text-state-danger font-bold" title="Required field">
                *
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-slate-400">
            <span className="uppercase font-medium tracking-wider">{field.type}</span>
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
        <button
          onClick={() => onEdit(field)}
          className="px-2 py-1 text-xs text-brand-indigo hover:bg-indigo-50 rounded transition-colors"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(field.id)}
          className="p-1 text-slate-400 hover:text-state-danger rounded transition-colors"
          title="Remove field"
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
  const [activeTab, setActiveTab] = useState<'fields' | 'knockout' | 'settings'>('fields');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [customFields, setCustomFields] = useState<FormField[]>([]);
  const [knockoutRules, setKnockoutRules] = useState<FormKnockoutRule[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Field editing modal/drawer state
  const [editingField, setEditingField] = useState<FormField | null>(null);
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldId, setFieldId] = useState('');
  const [fieldType, setFieldType] = useState<FormFieldType>('text');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldPlaceholder, setFieldPlaceholder] = useState('');
  const [fieldHelpText, setFieldHelpText] = useState('');
  const [fieldOptionsText, setFieldOptionsText] = useState('');

  // Setup sensors for dnd-kit
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
          label: 'Are you willing to relocate to work on-site if required?',
          type: 'boolean',
          required: true,
          isLocked: false
        }
      ]);
      setKnockoutRules([
        {
          id: `ko_${Date.now()}`,
          fieldId: 'willing_to_relocate',
          fieldLabel: 'Are you willing to relocate to work on-site if required?',
          operator: 'equals',
          value: false,
          reason: 'Candidate is unable or unwilling to relocate'
        }
      ]);
    }
    setErrorMsg(null);
  }, [formToEdit, isOpen]);

  if (!isOpen) return null;

  // Auto-generate slug from title if empty
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

  const handleOpenAddField = () => {
    const newId = `field_${Date.now().toString(36)}`;
    setEditingField({
      id: newId,
      label: 'New Question',
      type: 'text',
      required: false,
      isLocked: false
    });
    setFieldLabel('New Question');
    setFieldId(newId);
    setFieldType('text');
    setFieldRequired(false);
    setFieldPlaceholder('');
    setFieldHelpText('');
    setFieldOptionsText('');
  };

  const handleOpenEditField = (field: FormField) => {
    setEditingField(field);
    setFieldLabel(field.label);
    setFieldId(field.id);
    setFieldType(field.type);
    setFieldRequired(field.required || false);
    setFieldPlaceholder(field.placeholder || '');
    setFieldHelpText(field.helpText || '');
    setFieldOptionsText((field.options || []).join('\n'));
  };

  const handleSaveField = () => {
    if (!fieldLabel.trim()) return;

    const options =
      fieldType === 'select' || fieldType === 'multiselect'
        ? fieldOptionsText
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    const updated: FormField = {
      id: fieldId.trim() || `field_${Date.now()}`,
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
    // Also remove associated knockout rules
    setKnockoutRules((prev) => prev.filter((r) => r.fieldId !== id));
  };

  // Knockout rule handlers
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

      // Combine locked mandatory fields + custom drag-and-drop fields
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
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-primary flex items-center gap-2">
              <Sliders className="w-4 h-4 text-brand-indigo" />
              {formToEdit ? 'Edit Application Form' : 'Build Custom Application Form'}
            </h2>
            <p className="text-xs text-slate-secondary mt-0.5">
              Customize candidate questions, configure instant knockout rules, and publish public apply URLs.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-5 pt-2">
          {[
            { id: 'fields', label: `Questions (${LOCKED_MANDATORY_FIELDS.length + 1 + customFields.length})` },
            { id: 'knockout', label: `Knockout Rules (${knockoutRules.length})` },
            { id: 'settings', label: 'Slug & Publishing' }
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-brand-indigo text-brand-indigo'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {errorMsg && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-state-danger flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* TAB 1: FORM QUESTIONS */}
          {activeTab === 'fields' && (
            <div className="space-y-5">
              {/* Locked Fields Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    Locked & Mandatory Fields (System Defaults)
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">Fixed order & requirement</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    { label: 'Full Name', type: 'Short Text', desc: 'Auto-extracted & verified' },
                    { label: 'Email Address', type: 'Email', desc: 'Primary contact key' },
                    { label: 'Phone Number', type: 'Phone', desc: 'Direct outreach' },
                    { label: 'Resume File (.pdf)', type: 'PDF Upload', desc: 'Text-based PDF up to 10MB' }
                  ].map((field, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-xs text-slate-700"
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="w-3 h-3 text-slate-400" />
                        <div>
                          <div className="font-semibold text-slate-800 flex items-center gap-1">
                            {field.label}
                            <span className="text-state-danger font-bold">*</span>
                          </div>
                          <div className="text-[10px] text-slate-400">{field.desc}</div>
                        </div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-medium">
                        {field.type}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Custom Questions Section (Drag & Drop) */}
              <div className="space-y-3 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold text-slate-primary">Additional Custom Questions</h3>
                    <p className="text-[11px] text-slate-secondary">
                      Drag and drop using the handle to arrange the question order on the public form.
                    </p>
                  </div>
                  <button
                    onClick={handleOpenAddField}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-brand-indigo text-white hover:bg-brand-hover transition-colors shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Question
                  </button>
                </div>

                {customFields.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400">
                    No custom questions added yet. Click &ldquo;Add Question&rdquo; to add screening questions.
                  </div>
                ) : (
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={customFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-2">
                        {customFields.map((field) => (
                          <SortableFieldItem
                            key={field.id}
                            field={field}
                            onDelete={handleDeleteField}
                            onEdit={handleOpenEditField}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: KNOCKOUT RULES */}
          {activeTab === 'knockout' && (
            <div className="space-y-5">
              {/* Warning Alert Banner */}
              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-state-warning">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-state-warning" />
                <div>
                  <strong className="font-semibold text-amber-900 block mb-0.5">Automated Knockout Screening</strong>
                  Candidates who match any knockout rule are immediately classified as{' '}
                  <span className="font-semibold text-slate-800">Unshortlisted</span> (decision source:{' '}
                  <code>knockout</code>). They do not consume scoring credits, but remain fully visible in your HR
                  dashboard with the explicit knockout rejection reason.
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-primary">Configured Knockout Rules</h3>
                <button
                  onClick={handleAddKnockoutRule}
                  disabled={customFields.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 transition-colors shadow-xs disabled:opacity-40"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Knockout Rule
                </button>
              </div>

              {knockoutRules.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-lg text-xs text-slate-400">
                  No knockout rules configured. Candidates will be scored without automatic auto-rejection.
                </div>
              ) : (
                <div className="space-y-3">
                  {knockoutRules.map((rule, idx) => {
                    const targetField = customFields.find((f) => f.id === rule.fieldId);
                    return (
                      <div
                        key={rule.id}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 relative group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                            Rule #{idx + 1}
                          </span>
                          <button
                            onClick={() => handleRemoveKnockoutRule(rule.id)}
                            className="p-1 text-slate-400 hover:text-state-danger transition-colors"
                            title="Delete Rule"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          {/* Target Field */}
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">When Field</label>
                            <select
                              value={rule.fieldId}
                              onChange={(e) => {
                                const selected = customFields.find((f) => f.id === e.target.value);
                                setKnockoutRules((prev) =>
                                  prev.map((r) =>
                                    r.id === rule.id
                                      ? {
                                          ...r,
                                          fieldId: e.target.value,
                                          fieldLabel: selected?.label,
                                          value: selected?.type === 'boolean' ? false : ''
                                        }
                                      : r
                                  )
                                );
                              }}
                              className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:border-brand-indigo"
                            >
                              {customFields.map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.label} ({f.type})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Operator */}
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Condition</label>
                            <select
                              value={rule.operator}
                              onChange={(e) => {
                                setKnockoutRules((prev) =>
                                  prev.map((r) =>
                                    r.id === rule.id ? { ...r, operator: e.target.value as KnockoutOperator } : r
                                  )
                                );
                              }}
                              className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:border-brand-indigo"
                            >
                              <option value="equals">Equals</option>
                              <option value="not_equals">Does Not Equal</option>
                              <option value="less_than">Less Than</option>
                              <option value="greater_than">Greater Than</option>
                              <option value="contains">Contains</option>
                              <option value="excludes">Does Not Contain</option>
                            </select>
                          </div>

                          {/* Trigger Value */}
                          <div>
                            <label className="block text-[10px] font-semibold text-slate-600 mb-1">Knockout Value</label>
                            {targetField?.type === 'boolean' ? (
                              <select
                                value={String(rule.value)}
                                onChange={(e) => {
                                  const val = e.target.value === 'true';
                                  setKnockoutRules((prev) =>
                                    prev.map((r) => (r.id === rule.id ? { ...r, value: val } : r))
                                  );
                                }}
                                className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:border-brand-indigo"
                              >
                                <option value="false">No / False</option>
                                <option value="true">Yes / True</option>
                              </select>
                            ) : targetField?.type === 'number' ? (
                              <input
                                type="number"
                                value={rule.value as number}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setKnockoutRules((prev) =>
                                    prev.map((r) => (r.id === rule.id ? { ...r, value: val } : r))
                                  );
                                }}
                                className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:border-brand-indigo"
                                placeholder="e.g. 3"
                              />
                            ) : (
                              <input
                                type="text"
                                value={String(rule.value ?? '')}
                                onChange={(e) => {
                                  setKnockoutRules((prev) =>
                                    prev.map((r) => (r.id === rule.id ? { ...r, value: e.target.value } : r))
                                  );
                                }}
                                className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:border-brand-indigo"
                                placeholder="Triggering value"
                              />
                            )}
                          </div>
                        </div>

                        {/* Rejection Reason */}
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                            Internal Rejection Reason (Visible to HR in Dashboard)
                          </label>
                          <input
                            type="text"
                            value={rule.reason}
                            onChange={(e) => {
                              setKnockoutRules((prev) =>
                                prev.map((r) => (r.id === rule.id ? { ...r, reason: e.target.value } : r))
                              );
                            }}
                            className="w-full text-xs p-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:border-brand-indigo"
                            placeholder="e.g. Candidate answered No to mandatory relocation requirement"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SETTINGS & PUBLISHING */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Form Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Senior Full Stack Engineer Application"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:border-brand-indigo focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Public URL Slug</label>
                <div className="flex items-center">
                  <span className="px-3 py-2 bg-slate-100 border border-r-0 border-slate-300 rounded-l text-xs text-slate-500 font-mono">
                    /apply/
                  </span>
                  <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="fullstack-engineer"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-r focus:border-brand-indigo focus:outline-none font-mono"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Public candidates will submit applications via: <code className="text-brand-indigo">/apply/{slug || '...'}</code>
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-brand-indigo focus:ring-0"
                  />
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block">
                      Published (Accepting Submissions)
                    </span>
                    <span className="text-[11px] text-slate-400 block">
                      Uncheck to close the form. Closed forms reject new submissions while keeping all previous
                      submissions intact.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="text-xs text-slate-400">
            {customFields.length} custom questions • {knockoutRules.length} knockout rules
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveForm}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-semibold bg-brand-indigo text-white hover:bg-brand-hover transition-colors shadow-xs disabled:opacity-50"
            >
              {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {formToEdit ? 'Save Changes' : 'Publish Application Form'}
            </button>
          </div>
        </div>
      </div>

      {/* Field Editor Dialog */}
      {editingField && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-5 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-bold text-slate-primary">Configure Question</h4>
              <button
                onClick={() => setEditingField(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Question Label / Prompt</label>
                <input
                  type="text"
                  value={fieldLabel}
                  onChange={(e) => setFieldLabel(e.target.value)}
                  placeholder="e.g. Years of Experience with React"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:border-brand-indigo focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Field Type</label>
                  <select
                    value={fieldType}
                    onChange={(e) => setFieldType(e.target.value as FormFieldType)}
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:border-brand-indigo"
                  >
                    <option value="text">Short Text</option>
                    <option value="textarea">Long Text (Paragraph)</option>
                    <option value="number">Number</option>
                    <option value="boolean">Yes / No</option>
                    <option value="date">Date</option>
                    <option value="select">Dropdown Select</option>
                    <option value="multiselect">Multi-Select</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Internal Key</label>
                  <input
                    type="text"
                    value={fieldId}
                    onChange={(e) => setFieldId(e.target.value.replace(/[^a-z0-9_]/gi, '_'))}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:border-brand-indigo focus:outline-none font-mono"
                  />
                </div>
              </div>

              {(fieldType === 'select' || fieldType === 'multiselect') && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Options (One per line)</label>
                  <textarea
                    rows={4}
                    value={fieldOptionsText}
                    onChange={(e) => setFieldOptionsText(e.target.value)}
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:border-brand-indigo focus:outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Placeholder (Optional)</label>
                <input
                  type="text"
                  value={fieldPlaceholder}
                  onChange={(e) => setFieldPlaceholder(e.target.value)}
                  placeholder="e.g. Select an option or type answer..."
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:border-brand-indigo focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Help Text / Instructions (Optional)</label>
                <input
                  type="text"
                  value={fieldHelpText}
                  onChange={(e) => setFieldHelpText(e.target.value)}
                  placeholder="e.g. Include internships and full-time roles"
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded focus:border-brand-indigo focus:outline-none"
                />
              </div>

              <div className="pt-2 border-t border-slate-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fieldRequired}
                    onChange={(e) => setFieldRequired(e.target.checked)}
                    className="rounded border-slate-300 text-brand-indigo focus:ring-0"
                  />
                  <span className="font-semibold text-slate-700">Required field (cannot be left empty)</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setEditingField(null)}
                className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveField}
                disabled={!fieldLabel.trim()}
                className="px-3.5 py-1.5 rounded text-xs font-semibold bg-brand-indigo text-white hover:bg-brand-hover disabled:opacity-50 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
