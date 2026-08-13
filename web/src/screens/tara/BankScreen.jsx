'use client';

/**
 * The question bank.
 *
 * Everything ever written or entered, filterable by module, type and origin.
 * Past-paper questions are the volume source and generated ones fill the gaps,
 * so the origin filter is the important one: drilling only real questions is a
 * different exercise from drilling everything, and both are worth having.
 *
 * A bad question is retired rather than deleted. The attempts against it stay
 * meaningful, and the record of having got it wrong does not vanish.
 */

import { useState } from 'react';
import { api } from '../../../lib/api';
import { Page } from '../../components/shell/AppShell';
import Icon from '../../components/Icon';
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeading,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from '../../components/ui';
import { LABELS, orderOptions, pct, useResource, useTaraState } from '../../lib/tara';

/* -------------------------------------------------------------------------- */
/* Adding a real question                                                     */
/* -------------------------------------------------------------------------- */

const EMPTY = {
  module: 'ct',
  subcategory: '',
  source: '',
  passage: '',
  stem: '',
  options: ['', '', '', '', ''],
  answer: 'A',
  why: '',
  route: '',
  difficulty: 'medium',
};

function AddReal({ modules, onClose, onAdded }) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const module = modules.find((m) => m.id === form.module);
  const subs = module?.subcategories || [];
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const row = await api.tara.addQuestion({
        ...form,
        subcategory: form.subcategory || subs[0]?.id,
        options: form.options.map((text, i) => ({ label: LABELS[i], text })),
        distractors: LABELS.filter((l) => l !== form.answer).map((label) => ({
          label,
          why: 'Entered by hand — no explanation recorded.',
        })),
      });
      toast({ tone: 'success', title: 'Added to the bank', description: row.source || 'Past-paper question' });
      onAdded();
    } catch (e) {
      toast({ tone: 'danger', title: 'Could not add it', description: e.message });
    }
    setSaving(false);
  };

  const ready = form.stem.trim() && form.options.every((o) => o.trim());

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Add a past-paper question"
      description="Typed exactly as it appears. These are the volume source — generated questions only fill the gaps."
      actions={
        <>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} disabled={!ready} onClick={save}>
            Add to the bank
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Module"
            value={form.module}
            onChange={(e) => setForm((f) => ({ ...f, module: e.target.value, subcategory: '' }))}
            options={modules
              .filter((m) => m.kind === 'mcq')
              .map((m) => ({ value: m.id, label: m.name }))}
          />
          <Select
            label="Type"
            value={form.subcategory || subs[0]?.id || ''}
            onChange={(e) => set('subcategory', e.target.value)}
            options={subs.map((s) => ({ value: s.id, label: s.name }))}
          />
        </div>

        <Input
          label="Where it came from"
          placeholder="TSA 2019 Section 1 Q12"
          value={form.source}
          onChange={(e) => set('source', e.target.value)}
        />

        <Textarea
          label="Passage or data"
          rows={5}
          placeholder="The argument, scenario or table. Leave blank if the question stands alone."
          value={form.passage}
          onChange={(e) => set('passage', e.target.value)}
        />

        <Textarea
          label="The question"
          rows={2}
          value={form.stem}
          onChange={(e) => set('stem', e.target.value)}
        />

        {LABELS.map((label, i) => (
          <Input
            key={label}
            label={`Option ${label}`}
            value={form.options[i]}
            onChange={(e) =>
              setForm((f) => ({ ...f, options: f.options.map((o, j) => (i === j ? e.target.value : o)) }))
            }
          />
        ))}

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Correct answer"
            value={form.answer}
            onChange={(e) => set('answer', e.target.value)}
            options={LABELS.map((l) => ({ value: l, label: l }))}
          />
          <Select
            label="Difficulty"
            value={form.difficulty}
            onChange={(e) => set('difficulty', e.target.value)}
            options={[
              { value: 'easy', label: 'Easy' },
              { value: 'medium', label: 'Medium' },
              { value: 'hard', label: 'Hard' },
            ]}
          />
        </div>

        <Textarea
          label="Why that is the answer"
          rows={3}
          helper="Optional, but the explanation is what makes it worth re-drilling."
          value={form.why}
          onChange={(e) => set('why', e.target.value)}
        />
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function BankScreen() {
  const { toast } = useToast();
  const { data: state } = useTaraState();
  const [filters, setFilters] = useState({ module: '', subcategory: '', origin: 'any', retired: 'false' });
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState(null);

  const { data, status, error, reload } = useResource(
    () => api.tara.questions({ ...filters, take: 60 }),
    [filters.module, filters.subcategory, filters.origin, filters.retired],
  );

  const modules = state?.modules?.filter((m) => m.kind === 'mcq') || [];
  const subs = modules.find((m) => m.id === filters.module)?.subcategories || [];

  const retire = async (q, retired) => {
    try {
      await api.tara.editQuestion(q.id, { retired });
      toast({
        tone: 'success',
        title: retired ? 'Retired' : 'Back in the bank',
        description: retired
          ? 'It will not be drilled again. Your attempts against it are kept.'
          : 'It will appear in sets again.',
      });
      reload();
      setOpen(null);
    } catch (e) {
      toast({ tone: 'danger', title: 'Could not change it', description: e.message });
    }
  };

  return (
    <Page>
      <PageHeading
        eyebrow="TARA Drill"
        title="The bank"
        lead="Every question, kept. Past papers are the volume; generated questions fill the gaps."
        actions={
          <div className="flex items-center gap-1">
            <ButtonLink variant="tertiary" icon="arrowLeft" href="/tara">
              TARA Drill
            </ButtonLink>
            <Button variant="primary" icon="plus" onClick={() => setAdding(true)}>
              Add a real one
            </Button>
          </div>
        }
      />

      <div className="cd-bankfilters">
        <Select
          label="Module"
          value={filters.module}
          onChange={(e) => setFilters((f) => ({ ...f, module: e.target.value, subcategory: '' }))}
          options={[{ value: '', label: 'All modules' }, ...modules.map((m) => ({ value: m.id, label: m.name }))]}
        />
        <Select
          label="Type"
          disabled={!filters.module}
          value={filters.subcategory}
          onChange={(e) => setFilters((f) => ({ ...f, subcategory: e.target.value }))}
          options={[{ value: '', label: 'All types' }, ...subs.map((s) => ({ value: s.id, label: s.name }))]}
        />
        <Select
          label="Origin"
          value={filters.origin}
          onChange={(e) => setFilters((f) => ({ ...f, origin: e.target.value }))}
          options={[
            { value: 'any', label: 'Real and generated' },
            { value: 'real', label: 'Past papers only' },
            { value: 'generated', label: 'Generated only' },
          ]}
        />
        <Select
          label="Showing"
          value={filters.retired}
          onChange={(e) => setFilters((f) => ({ ...f, retired: e.target.value }))}
          options={[
            { value: 'false', label: 'In use' },
            { value: 'true', label: 'Retired' },
          ]}
        />
      </div>

      {status === 'loading' && !data ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} height="4rem" rounded="card" />
          ))}
        </div>
      ) : status === 'error' ? (
        <ErrorState
          title="The bank could not be loaded"
          body="Your questions are safe on the server. This is a connection problem, not lost work."
          detail={error}
          onRetry={reload}
        />
      ) : data.questions.length === 0 ? (
        <EmptyState
          icon="layers"
          title={filters.retired === 'true' ? 'Nothing retired' : 'Nothing matches'}
          body={
            filters.retired === 'true'
              ? 'You have not retired any questions. A question you find fault with goes here rather than being deleted.'
              : 'Widen the filters, or add a past-paper question by hand.'
          }
          action={{ label: 'Add a real one', onClick: () => setAdding(true), icon: 'plus' }}
        />
      ) : (
        <>
          <p className="cd-eyebrow">{data.total} questions</p>
          <ul className="cd-banklist list-none">
            {data.questions.map((q) => (
              <li key={q.id}>
                <button type="button" className="cd-bankrow" onClick={() => setOpen(q)}>
                  <span className="cd-bankrow__body">
                    <span className="cd-bankrow__stem">{q.stem}</span>
                    <span className="cd-bankrow__meta">
                      <Badge tone={q.origin === 'real' ? 'success' : 'neutral'}>
                        {q.origin === 'real' ? q.source || 'Past paper' : 'Generated'}
                      </Badge>
                      <span>{q.subcategory}</span>
                      <span>{q.difficulty}</span>
                      {q.asked ? (
                        <span>
                          {pct(q.right / q.asked)} over {q.asked}
                        </span>
                      ) : (
                        <span>never asked</span>
                      )}
                    </span>
                  </span>
                  <Icon name="chevronRight" size={15} className="cd-bankrow__go" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {adding ? (
        <AddReal
          modules={modules}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            reload();
          }}
        />
      ) : null}

      {open ? (
        <Modal
          open
          size="lg"
          onClose={() => setOpen(null)}
          title="Question"
          actions={
            <>
              <Button variant="tertiary" onClick={() => setOpen(null)}>
                Close
              </Button>
              <Button variant={open.retired ? 'secondary' : 'danger'} onClick={() => retire(open, !open.retired)}>
                {open.retired ? 'Put it back' : 'Retire it'}
              </Button>
            </>
          }
        >
          {open.passage ? <pre className="cd-passage">{open.passage}</pre> : null}
          <p className="cd-question__stem">{open.stem}</p>
          <ul className="cd-options list-none">
            {orderOptions(open.options).map((o) => (
              <li key={o.label}>
                <span className={o.label === open.answer ? 'cd-option is-key' : 'cd-option'}>
                  <span className="cd-option__label">{o.label}</span>
                  <span className="cd-option__text">{o.text}</span>
                </span>
              </li>
            ))}
          </ul>
          {open.route ? <p className="cd-explain__route">{open.route}</p> : null}
          <p className="cd-explain__why">{open.why}</p>
        </Modal>
      ) : null}
    </Page>
  );
}

export default BankScreen;
