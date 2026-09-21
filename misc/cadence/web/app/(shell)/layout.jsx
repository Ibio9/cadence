'use client';

/**
 * Everything that lives inside the shell.
 *
 * Grouping the shelled routes here keeps the sidebar mounted across a
 * navigation, and leaves Focus free to be a route with no shell at all.
 */

import { AppShell } from '../../src/components/shell/AppShell';

export default function ShellLayout({ children }) {
  return <AppShell>{children}</AppShell>;
}
