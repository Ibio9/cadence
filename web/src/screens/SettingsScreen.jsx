'use client';

/**
 * Settings.
 *
 * Theme control as live preview cards, not a dropdown. Each card renders its
 * own theme by scoping data-theme to the preview, so both options show their
 * real page ground, card, accent and text sample whichever theme is active.
 *
 * Everything else on this screen is read only. Nothing here writes to the API
 * or changes stored app data.
 */

import { useEffect, useState } from 'react';
import { Page } from '../components/shell/AppShell';
import Icon from '../components/Icon';
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  PageHeading,
  PartialNotice,
  Skeleton,
  Table,
} from '../components/ui';
import { useTheme } from '../context/ThemeContext';

const STORAGE_KEYS = [
  { key: 'cadence_theme', holds: 'Theme preference' },
  { key: 'cadence_checklist_<date>', holds: "One day's habits and ticks" },
  { key: 'cadence_streaks', holds: 'Run length per habit' },
  { key: 'cadence_timetable_<date>', holds: "One day's hours" },
  { key: 'cadence_notes', holds: 'Every note' },
  { key: 'cadence_note_cats', holds: 'Categories you added' },
  { key: 'cadence_jarvis_history', holds: 'Last 60 messages' },
];

function ThemePreview({ themeId }) {
  return (
    <div data-theme={themeId} className="cd-themecard__preview bg-bg">
      <div className="cd-card p-3 flex flex-col gap-2">
        <p className="font-display text-sm text-ink leading-tight">Good morning, Ibrahim.</p>
        <p className="font-display italic text-caption text-accent">One line, held in blue.</p>
        <p className="text-caption text-ink-muted">Body copy sits here.</p>
        <div className="flex items-center gap-2 pt-1">
          <span className="cd-themecard__chip bg-accent" style={{ width: 28 }} />
          <span className="cd-themecard__chip bg-accent-tint" style={{ width: 20 }} />
          <span className="cd-themecard__chip bg-border" style={{ width: 16 }} />
        </div>
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <Page>
      <div className="flex flex-col gap-3">
        <Skeleton width="6rem" height="0.7rem" rounded="pill" />
        <Skeleton width="min(16rem, 70%)" height="2.4rem" rounded="pill" />
      </div>
      <Card>
        <CardBody className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton height="12rem" rounded="card" />
          <Skeleton height="12rem" rounded="card" />
        </CardBody>
      </Card>
    </Page>
  );
}

export function SettingsScreen() {
  const { theme, setTheme, themes, ready, persistError } = useTheme();
  const [reducedMotion, setReducedMotion] = useState(false);
  const [apiBase, setApiBase] = useState('');

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    setApiBase(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080');
  }, []);

  if (!ready) return <SettingsSkeleton />;

  return (
    <Page>
      <PageHeading
        eyebrow="Preferences"
        title="Settings"
        accent="Set it once and the whole app follows."
      />

      {persistError ? (
        <PartialNotice>
          The theme is applied for this session but could not be saved. Private browsing or a full storage quota will
          do that. It will fall back to light blue next time.
        </PartialNotice>
      ) : null}

      {/* Theme */}
      <Card as="section" aria-label="Theme">
        <CardHeader
          eyebrow="Appearance"
          title="Theme"
          description="Both themes are built to the same contrast rules. Pick the one that suits the room."
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="group" aria-label="Choose a theme">
            {themes.map((t) => {
              const active = t.id === theme;
              return (
                <button
                  key={t.id}
                  type="button"
                  className="cd-themecard"
                  aria-pressed={active}
                  onClick={() => setTheme(t.id)}
                >
                  <ThemePreview themeId={t.id} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-base font-medium text-ink">{t.name}</p>
                      <p className="text-caption text-ink-muted">{t.description}</p>
                    </div>
                    {active ? <Badge tone="accent" icon="checkCircle">In use</Badge> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* Motion and access */}
      <Card as="section" aria-label="Motion">
        <CardHeader
          eyebrow="Motion"
          title="Animation"
          description="Cadence follows your system setting. There is nothing to switch here."
        />
        <CardBody className="flex flex-col gap-3">
          <p className="flex items-center gap-3 text-sm text-ink-muted">
            <Icon name={reducedMotion ? 'checkCircle' : 'info'} size={16} />
            {reducedMotion
              ? 'Reduced motion is on in your system settings, so transitions are switched off.'
              : 'Reduced motion is off in your system settings, so transitions are on.'}
          </p>
          <p className="text-caption text-ink-subtle max-w-prose">
            Loading indicators keep a slow pulse either way, so it is always clear when something is still working.
          </p>
        </CardBody>
      </Card>

      {/* Data */}
      <Card as="section" aria-label="Stored data">
        <CardHeader
          eyebrow="Data"
          title="What is stored on this device"
          description="Cadence keeps your day in this browser. Nothing on this screen changes it."
        />
        <CardBody className="flex flex-col gap-4">
          <Table
            caption="Local storage keys used by Cadence"
            columns={[
              { key: 'key', header: 'Key', render: (r) => <span className="font-mono text-caption">{r.key}</span> },
              { key: 'holds', header: 'Holds' },
            ]}
            rows={STORAGE_KEYS}
            getRowId={(r) => r.key}
          />
          <p className="text-caption text-ink-subtle break-words">
            API base: <span className="font-mono">{apiBase}</span>
          </p>
        </CardBody>
      </Card>

      {/* Keyboard */}
      <Card as="section" aria-label="Keyboard shortcuts">
        <CardHeader eyebrow="Keyboard" title="Shortcuts" description="Everything here also works with the mouse." />
        <CardBody>
          <Table
            caption="Keyboard shortcuts"
            columns={[
              { key: 'keys', header: 'Keys', render: (r) => <span className="font-mono text-caption">{r.keys}</span> },
              { key: 'does', header: 'Does' },
            ]}
            rows={[
              { keys: 'Tab', does: 'Move through every control in reading order' },
              { keys: 'Space', does: 'Tick or untick a habit' },
              { keys: 'Enter', does: 'Generate the timetable, or send to Jarvis' },
              { keys: 'Ctrl or Cmd + Enter', does: 'Save a note from the capture box' },
              { keys: 'Escape', does: 'Close a dialog or panel' },
            ]}
            getRowId={(r) => r.keys}
          />
        </CardBody>
      </Card>
    </Page>
  );
}

export default SettingsScreen;
