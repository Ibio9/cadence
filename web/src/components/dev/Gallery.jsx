'use client';

/**
 * The primitive gallery. Every primitive, every state, rendered twice, once
 * per theme, on one page. Used to check consistency before building screens
 * and kept in the repo so it keeps doing that job.
 */

import { useState } from 'react';
import Icon, { ICON_NAMES } from '../Icon';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Checkbox,
  EmptyState,
  ErrorState,
  IconButton,
  InlineError,
  Input,
  Modal,
  PageHeading,
  Pagination,
  PartialNotice,
  ProgressRing,
  Radio,
  RadioGroup,
  Select,
  Sheet,
  Skeleton,
  SkeletonText,
  Spinner,
  Switch,
  Table,
  Tabs,
  Textarea,
  Tooltip,
  useToast,
} from '../ui';

function Section({ title, children }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-eyebrow text-ink-subtle border-b pb-2">{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption text-ink-subtle font-mono">{label}</p>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

const TABLE_COLUMNS = [
  { key: 'name', header: 'Session' },
  { key: 'type', header: 'Type' },
  { key: 'minutes', header: 'Minutes', numeric: true },
  { key: 'rate', header: 'Held', numeric: true },
];

const TABLE_ROWS = [
  { id: 1, name: 'TARA critical reasoning', type: 'Study', minutes: 90, rate: '82.5%' },
  { id: 2, name: 'StudentSolve marking engine', type: 'Build', minutes: 120, rate: '100.0%' },
  { id: 3, name: 'Muay Thai', type: 'Training', minutes: 75, rate: '66.7%' },
  { id: 4, name: 'Market review', type: 'Markets', minutes: 30, rate: '9.0%' },
];

export function Gallery({ themeId, label }) {
  const { toast } = useToast();
  const [tab, setTab] = useState('one');
  const [pillTab, setPillTab] = useState('all');
  const [checked, setChecked] = useState(true);
  const [radio, setRadio] = useState('b');
  const [switched, setSwitched] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bottomSheetOpen, setBottomSheetOpen] = useState(false);
  const [page, setPage] = useState(4);
  const [selectedRow, setSelectedRow] = useState(2);

  return (
    <div data-theme={themeId} className="bg-bg text-ink">
      <div className="flex flex-col gap-12 p-6 md:p-card">
        <p className="text-eyebrow text-accent">{label}</p>

        {/* PageHeading -------------------------------------------------- */}
        <Section title="PageHeading">
          <PageHeading
            eyebrow="Monday, 10 August"
            title="Good morning, Ibrahim."
            accent="Protect the first three hours. Everything else can move."
            level={2}
            actions={<Button icon="sparkle">Generate</Button>}
          />
          <PageHeading eyebrow="Loading" title="Resolving the brief" accentLoading level={2} />
          <PageHeading
            eyebrow="Error"
            title="Brief unavailable"
            accentError="Jarvis did not answer, so this is a standing reminder rather than a fresh one."
            level={2}
          />
        </Section>

        {/* Card --------------------------------------------------------- */}
        <Section title="Card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader eyebrow="Default" title="On surface" description="Hairline border, small lift." />
              <CardBody>
                <p className="text-sm text-ink-muted">Body copy sits at the reading size with generous leading.</p>
              </CardBody>
              <CardFooter>
                <Button variant="tertiary">Action</Button>
              </CardFooter>
            </Card>
            <Card variant="raised">
              <CardHeader title="Raised" description="Overlay ground, medium lift." />
              <CardBody>
                <p className="text-sm text-ink-muted">Used for modals, sheets and popovers.</p>
              </CardBody>
            </Card>
            <Card interactive selected>
              <CardHeader title="Selected" description="Accent tint, accent border." />
              <CardBody>
                <p className="text-sm text-ink-muted">Interactive cards lift on hover.</p>
              </CardBody>
            </Card>
          </div>
        </Section>

        {/* Button ------------------------------------------------------- */}
        <Section title="Button">
          {['primary', 'secondary', 'tertiary', 'ghost', 'danger', 'danger-solid'].map((variant) => (
            <Row key={variant} label={variant}>
              <Button variant={variant}>Rest</Button>
              <Button variant={variant} icon="plus">
                With icon
              </Button>
              <Button variant={variant} loading>
                Loading
              </Button>
              <Button variant={variant} disabled>
                Disabled
              </Button>
              <Button variant={variant} size="sm">
                Small
              </Button>
              <Button variant={variant} size="lg">
                Large
              </Button>
            </Row>
          ))}
          <Row label="block">
            <Button block icon="sparkle">
              Full width
            </Button>
          </Row>
        </Section>

        {/* IconButton --------------------------------------------------- */}
        <Section title="IconButton">
          <Row label="variants">
            <IconButton icon="plus" label="Add something" />
            <IconButton icon="plus" label="Add, primary" variant="primary" />
            <IconButton icon="edit" label="Edit, secondary" variant="secondary" />
            <IconButton icon="trash" label="Delete" variant="danger" />
            <IconButton icon="refresh" label="Refreshing" loading />
            <IconButton icon="close" label="Disabled" disabled />
            <IconButton icon="search" label="Small" size="sm" />
          </Row>
        </Section>

        {/* Inputs ------------------------------------------------------- */}
        <Section title="Input, Textarea, Select">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Rest" placeholder="Placeholder" helper="Helper text sits below." />
            <Input label="Filled" defaultValue="TARA critical reasoning" iconStart="search" />
            <Input label="Invalid" defaultValue="9" error="Enter an hour between 6 and 22." />
            <Input label="Disabled" defaultValue="Not editable" disabled />
            <Input label="Numeric" mono defaultValue="1420.75" iconEnd="clock" />
            <Input label="Optional" optional placeholder="Leave it blank" />
            <Select label="Select" options={['Study', 'Build', 'Training']} />
            <Select label="Select, invalid" options={['Study']} error="Pick a type." />
            <Select label="Select, disabled" options={['Study']} disabled />
            <Textarea label="Textarea" rows={3} placeholder="What is on your mind?" />
            <Textarea label="Textarea, invalid" rows={3} error="Write something first." />
            <Textarea label="Textarea, disabled" rows={3} disabled defaultValue="Locked" />
          </div>
        </Section>

        {/* Choices ------------------------------------------------------ */}
        <Section title="Checkbox, Radio, Switch">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col">
              <Checkbox label="Unchecked" checked={false} onChange={() => {}} />
              <Checkbox label="Checked" checked={checked} onChange={() => setChecked((v) => !v)} />
              <Checkbox label="Indeterminate" indeterminate checked={false} onChange={() => {}} />
              <Checkbox label="Disabled" disabled checked={false} onChange={() => {}} />
              <Checkbox label="Invalid" error checked={false} onChange={() => {}} />
              <Checkbox label="With description" description="Extra context under the label." checked onChange={() => {}} />
            </div>
            <div className="flex flex-col">
              <RadioGroup
                legend="Energy"
                name={`energy-${themeId}`}
                value={radio}
                onChange={setRadio}
                options={[
                  { value: 'a', label: 'Deep', description: 'Long uninterrupted block' },
                  { value: 'b', label: 'Admin' },
                  { value: 'c', label: 'Light', disabled: true },
                ]}
              />
              <Radio name={`solo-${themeId}`} label="Invalid" error checked={false} onChange={() => {}} />
            </div>
            <div className="flex flex-col">
              <Switch label="On" checked={switched} onChange={() => setSwitched((v) => !v)} />
              <Switch label="Off" checked={false} onChange={() => {}} />
              <Switch label="Disabled" disabled checked={false} onChange={() => {}} />
              <Switch
                label="With description"
                description="Explains what the switch changes."
                checked
                onChange={() => {}}
              />
            </div>
          </div>
        </Section>

        {/* Badge -------------------------------------------------------- */}
        <Section title="Badge">
          <Row label="tones">
            <Badge tone="neutral" icon={null}>
              Neutral
            </Badge>
            <Badge tone="accent">Accent</Badge>
            <Badge tone="success">Held</Badge>
            <Badge tone="warning">Partly held</Badge>
            <Badge tone="danger">Missed</Badge>
            <Badge tone="outline" icon={null}>
              Outline
            </Badge>
            <Badge tone="neutral" icon="flame" mono>
              12d
            </Badge>
          </Row>
        </Section>

        {/* Tabs --------------------------------------------------------- */}
        <Section title="Tabs">
          <Tabs
            label="Underline example"
            value={tab}
            onChange={setTab}
            items={[
              { value: 'one', label: 'Overview', icon: 'today' },
              { value: 'two', label: 'History', count: 12 },
              { value: 'three', label: 'Disabled', disabled: true },
            ]}
          />
          <Tabs
            variant="pill"
            label="Pill example"
            value={pillTab}
            onChange={setPillTab}
            items={[
              { value: 'all', label: 'All', count: 24 },
              { value: 'ideas', label: 'Ideas', count: 9 },
              { value: 'todo', label: 'To Do', count: 3 },
            ]}
          />
        </Section>

        {/* Table -------------------------------------------------------- */}
        <Section title="Table">
          <Card className="overflow-hidden">
            <Table
              caption="Sessions"
              columns={TABLE_COLUMNS}
              rows={TABLE_ROWS}
              selectedId={selectedRow}
              onRowClick={(r) => setSelectedRow(r.id)}
            />
          </Card>
          <Card className="overflow-hidden">
            <Table caption="Loading" columns={TABLE_COLUMNS} rows={[]} loading />
          </Card>
          <Card className="overflow-hidden">
            <Table caption="Empty" columns={TABLE_COLUMNS} rows={[]} emptyMessage="No sessions logged yet." />
          </Card>
        </Section>

        {/* Overlays ----------------------------------------------------- */}
        <Section title="Modal, Sheet">
          <Row label="triggers">
            <Button variant="secondary" onClick={() => setModalOpen(true)}>
              Open modal
            </Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              Open side sheet
            </Button>
            <Button variant="secondary" onClick={() => setBottomSheetOpen(true)}>
              Open bottom sheet
            </Button>
          </Row>
          <Modal
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            title="Clear this hour"
            description="The hour goes back to open. Nothing else on the day moves."
            actions={
              <>
                <Button variant="secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="danger-solid" onClick={() => setModalOpen(false)}>
                  Clear hour
                </Button>
              </>
            }
          >
            <Input data-autofocus label="Confirm the hour" defaultValue="14:00" mono />
          </Modal>
          <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Note" footer={<Button variant="secondary" onClick={() => setSheetOpen(false)}>Done</Button>}>
            <Textarea label="Body" rows={10} defaultValue="Editing in a side sheet." />
          </Sheet>
          <Sheet open={bottomSheetOpen} side="bottom" onClose={() => setBottomSheetOpen(false)} title="Filters">
            <p className="text-sm text-ink-muted">The bottom edge is the mobile default.</p>
          </Sheet>
        </Section>

        {/* Toast -------------------------------------------------------- */}
        <Section title="Toast">
          <Row label="tones">
            <Button variant="secondary" onClick={() => toast({ title: 'Saved', description: 'Filed under Ideas.' })}>
              Info
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast({ tone: 'success', title: 'Placed on today', description: 'Scheduled for 15:00.' })}
            >
              Success
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({ tone: 'warning', title: 'Saved, but not scheduled', description: 'Jarvis did not name an hour.' })
              }
            >
              Warning
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  tone: 'danger',
                  title: 'Not reachable',
                  description: 'The server did not answer.',
                  action: { label: 'Try again', onClick: () => {} },
                })
              }
            >
              Danger with action
            </Button>
          </Row>
        </Section>

        {/* Tooltip, Avatar, Spinner, ProgressRing ----------------------- */}
        <Section title="Tooltip, Avatar, Spinner, ProgressRing">
          <Row label="tooltip">
            <Tooltip label="Focus me with Tab as well">
              <Button variant="secondary">Hover or focus</Button>
            </Tooltip>
            <Tooltip label="Below" placement="bottom">
              <IconButton icon="info" label="More information" />
            </Tooltip>
          </Row>
          <Row label="avatar">
            <Avatar name="Ibrahim Malik" size="sm" />
            <Avatar name="Ibrahim Malik" />
            <Avatar name="Ibrahim Malik" size="lg" />
            <Avatar name="" />
          </Row>
          <Row label="spinner">
            <Spinner size="sm" />
            <Spinner />
            <Spinner size="lg" />
          </Row>
          <Row label="progress ring">
            <ProgressRing value={0} />
            <ProgressRing value={42} />
            <ProgressRing value={100} />
            <ProgressRing value={68} size={96} stroke={7} />
          </Row>
        </Section>

        {/* Skeleton ----------------------------------------------------- */}
        <Section title="Skeleton">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardBody className="flex flex-col gap-3">
                <Skeleton width="40%" height="0.7rem" rounded="pill" />
                <SkeletonText lines={3} />
              </CardBody>
            </Card>
            <div className="flex flex-col gap-3">
              <Skeleton height="3rem" rounded="card" />
              <div className="flex items-center gap-3">
                <Skeleton width="44px" height="44px" rounded="circle" />
                <Skeleton height="0.75rem" rounded="pill" />
              </div>
            </div>
          </div>
        </Section>

        {/* States ------------------------------------------------------- */}
        <Section title="EmptyState, ErrorState, InlineError, PartialNotice">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <EmptyState
                icon="inbox"
                title="Nothing captured yet"
                body="Notes work best when they cost nothing to write. Put the first thought in and file it later."
                action={{ label: 'Write a note', icon: 'plus', onClick: () => {} }}
              />
            </Card>
            <Card>
              <ErrorState
                title="Jarvis did not answer"
                body="The server may be down or the request timed out. Your work is saved either way."
                detail="POST /api/jarvis"
                onRetry={() => {}}
              />
            </Card>
          </div>
          <InlineError onRetry={() => {}}>
            The brief did not load. Everything below still works.
          </InlineError>
          <PartialNotice>
            Nine hours came back and are on the grid. Fill the rest by clicking any empty hour.
          </PartialNotice>
        </Section>

        {/* Pagination --------------------------------------------------- */}
        <Section title="Pagination">
          <Pagination page={page} total={12} onChange={setPage} />
          <Pagination page={1} total={4} onChange={() => {}} />
        </Section>

        {/* Type scale --------------------------------------------------- */}
        <Section title="Type scale">
          <p className="text-eyebrow text-ink-subtle">Eyebrow, uppercase, letterspaced</p>
          <p className="font-display text-display">Display 48</p>
          <p className="font-display text-4xl">Heading 38</p>
          <p className="font-display text-3xl">Heading 30</p>
          <p className="font-display text-2xl">Heading 24</p>
          <p className="font-display italic text-lg text-accent">The italic accent line, 17</p>
          <p className="text-base text-ink">Body 15, the reading size, set with generous line height.</p>
          <p className="text-sm text-ink-muted">Small 13, descriptions and secondary copy.</p>
          <p className="text-caption text-ink-subtle">Caption 12, metadata and timestamps.</p>
          <p className="font-mono text-base">0123456789 tabular 1,420.75</p>
        </Section>

        {/* Icons -------------------------------------------------------- */}
        <Section title="Icons">
          <div className="flex flex-wrap gap-4">
            {ICON_NAMES.map((n) => (
              <span key={n} className="flex flex-col items-center gap-1 text-ink-muted" style={{ width: 72 }}>
                <Icon name={n} size={20} />
                <span className="text-caption text-ink-subtle truncate max-w-full">{n}</span>
              </span>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

export default Gallery;
