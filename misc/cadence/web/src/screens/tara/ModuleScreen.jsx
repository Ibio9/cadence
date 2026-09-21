'use client';

/**
 * One module: its question types, and how to drill them.
 *
 * Every row carries its own accuracy and its own average time against the
 * budget, because those are the two ways a module goes wrong and they need
 * different fixes. A row with no attempts says "untried" and shows no
 * percentage — inventing a 0% for a type that has never been opened would put
 * it at the top of the weakness list for no reason.
 */

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Page } from '../../components/shell/AppShell';
import Icon from '../../components/Icon';
import {
  Badge,
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  Modal,
  PageHeading,
  RadioGroup,
  Skeleton,
  useToast,
} from '../../components/ui';
import { api } from '../../../lib/api';
import BankBuild from '../../components/tara/BankBuild';
import { pct, secs, standing, useBankBuild, useTaraState } from '../../lib/tara';
import WritingScreen from './WritingScreen';

const COUNTS = [
  { value: '5', label: '5 questions' },
  { value: '10', label: '10 questions' },
  { value: '15', label: '15 questions' },
  { value: '22', label: '22 — a full module' },
];

/* -------------------------------------------------------------------------- */
/* The launcher                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Choosing a set. Untimed shows the explanation as you go; timed holds you to
 * the real per-question budget and says nothing until the end.
 */
function Launcher({ module, sub, onClose, onGenerated }) {
  const router = useRouter();
  const { toast } = useToast();
  const [mode, setMode] = useState('practice');
  const [count, setCount] = useState('10');
  const [origin, setOrigin] = useState('any');
  const [busy, setBusy] = useState(false);

  const available = sub.bank - sub.mastered;
  const wanted = Number(count);

  const start = () => {
    const params = new URLSearchParams({ module: module.id, sub: sub.id, mode, count, origin });
    router.push(`/tara/drill?${params}`);
  };

  const generate = async () => {
    setBusy(true);
    try {
      const res = await api.tara.generate({ module: module.id, subcategory: sub.id, count: 5 });
      const dropped = res.rejected?.length || 0;
      toast({
        tone: res.added ? 'success' : 'danger',
        title: res.added ? `${res.added} added` : 'Nothing usable came back',
        description: dropped
          ? `${dropped} were thrown away for being malformed. They are not in the bank.`
          : 'Written from this type’s own rules and checked before it went in.',
      });
      onGenerated?.();
    } catch (e) {
      toast({ tone: 'danger', title: 'Nothing was written', description: e.message });
    }
    setBusy(false);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={sub.name}
      description={sub.attack}
      actions={
        <>
          <Button variant="tertiary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="go" icon="play" disabled={available === 0} onClick={start}>
            Start
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <RadioGroup
          legend="How"
          name="mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'practice', label: 'Untimed', helper: 'Answer, then read the explanation straight away.' },
            {
              value: 'timed',
              label: 'Timed',
              helper: `${secs(module.secondsPerQuestion)} a question, the real budget. Explanations at the end.`,
            },
            { value: 'review', label: 'Review', helper: 'Only questions you have seen before, including the ones you have mastered.' },
          ]}
        />

        <RadioGroup legend="How many" name="count" value={count} onChange={setCount} options={COUNTS} />

        <RadioGroup
          legend="From"
          name="origin"
          value={origin}
          onChange={setOrigin}
          options={[
            { value: 'any', label: 'Anything in the bank' },
            { value: 'real', label: 'Past-paper questions only' },
            { value: 'generated', label: 'Generated questions only' },
          ]}
        />

        <div className="cd-launcher__stock">
          <p>
            <strong>{available}</strong> ready to drill
            {sub.mastered ? <> · {sub.mastered} held back as mastered</> : null}
            {sub.unseen ? <> · {sub.unseen} never seen</> : null}
          </p>
          {available < wanted ? (
            <p className="cd-launcher__short">
              Fewer than {wanted}. You will get {available}. Write more to fill the set.
            </p>
          ) : null}
          <Button variant="secondary" icon="sparkle" size="sm" loading={busy} onClick={generate}>
            Write five more
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */
/* Rows                                                                       */
/* -------------------------------------------------------------------------- */

function SubRow({ sub, module, onOpen }) {
  const s = standing(sub.accuracy);
  const slow = sub.avgSeconds != null && sub.avgSeconds > module.secondsPerQuestion;

  return (
    <li>
      <button type="button" className="cd-subrow" onClick={() => onOpen(sub)}>
        <span className="cd-subrow__body">
          <span className="cd-subrow__name">{sub.name}</span>
          <span className="cd-subrow__attack">{sub.attack}</span>
        </span>

        <span className="cd-subrow__stats">
          <span className="cd-subrow__stat">
            <span className="cd-subrow__value">{pct(sub.accuracy)}</span>
            <span className="cd-subrow__label">{sub.asked ? `${sub.right}/${sub.asked}` : 'untried'}</span>
          </span>
          <span className="cd-subrow__stat">
            <span className={slow ? 'cd-subrow__value is-over' : 'cd-subrow__value'}>
              {secs(sub.avgSeconds)}
            </span>
            <span className="cd-subrow__label">of {secs(module.secondsPerQuestion)}</span>
          </span>
          <span className="cd-subrow__stat">
            <span className="cd-subrow__value">{sub.bank}</span>
            <span className="cd-subrow__label">in bank</span>
          </span>
        </span>

        <Badge tone={s.tone}>{s.label}</Badge>
        <Icon name="chevronRight" size={15} className="cd-subrow__go" />
      </button>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

export function ModuleScreen({ moduleId }) {
  const { data, status, error, reload } = useTaraState();
  const [open, setOpen] = useState(null);
  const build = useBankBuild({ onDone: reload });

  const module = useMemo(() => data?.modules.find((m) => m.id === moduleId), [data, moduleId]);

  if (status === 'loading' && !data) {
    return (
      <Page>
        <div className="flex flex-col gap-3">
          <Skeleton width="7rem" height="0.7rem" rounded="pill" />
          <Skeleton width="min(18rem, 65%)" height="2.4rem" rounded="pill" />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height="4.5rem" rounded="card" />
        ))}
      </Page>
    );
  }

  if (status === 'error' && !data) {
    return (
      <Page>
        <ErrorState
          title="That module did not load"
          body="The server did not answer. Your bank is on it, so nothing is lost. Check your connection and try again."
          detail={error}
          onRetry={reload}
        />
      </Page>
    );
  }

  if (!module) {
    return (
      <Page>
        <ErrorState
          title="No module by that name"
          body="There are three: Critical Thinking, Problem Solving and the Writing Task."
          action={{ label: 'Back to TARA', href: '/tara' }}
        />
      </Page>
    );
  }

  if (module.kind === 'essay') {
    return <WritingScreen module={module} state={data} onChange={reload} />;
  }

  const grouped = module.flat
    ? [{ id: null, name: null, blurb: null, subs: module.subcategories }]
    : module.groups.map((g) => ({ ...g, subs: module.subcategories.filter((s) => s.group === g.id) }));

  return (
    <Page>
      <PageHeading
        eyebrow={<>TARA Drill · {module.questions} questions · {module.minutes} minutes</>}
        title={module.name}
        lead={module.blurb}
        actions={
          <div className="flex items-center gap-1">
            <ButtonLink variant="secondary" icon="flame" href={`/tara/drill?module=${module.id}&mode=weakness&count=10`}>
              Weakness set
            </ButtonLink>
            <ButtonLink variant="primary" icon="target" href={`/tara/drill?module=${module.id}&mode=mock`}>
              Sit a mock
            </ButtonLink>
          </div>
        }
      />

      <BankBuild state={build} />

      {module.bank === 0 && !build?.running ? (
        <EmptyState
          title={`${module.name} is still being written`}
          body="Fifteen questions for every type below, each written from that type's own construction rules and checked before it goes in. It happens on the server. Open a type to start one early."
        />
      ) : null}

      {grouped.map((group) => (
        <section key={group.id || 'all'} className="cd-subgroup">
          {group.name ? (
            <header className="cd-subgroup__head">
              <h2 className="cd-subgroup__name">{group.name}</h2>
              <p className="cd-subgroup__blurb">{group.blurb}</p>
            </header>
          ) : null}
          <ul className="cd-sublist list-none">
            {group.subs.map((sub) => (
              <SubRow key={sub.id} sub={sub} module={module} onOpen={setOpen} />
            ))}
          </ul>
        </section>
      ))}

      {open ? (
        <Launcher
          module={module}
          sub={open}
          onClose={() => setOpen(null)}
          onGenerated={() => {
            reload();
            setOpen(null);
          }}
        />
      ) : null}
    </Page>
  );
}

export default ModuleScreen;
