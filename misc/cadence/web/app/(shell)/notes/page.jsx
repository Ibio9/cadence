'use client';

import { useEffect, useState } from 'react';
import { todayKey } from '../../../lib/api';
import NotesScreen from '../../../src/screens/NotesScreen';

export default function NotesPage() {
  const [day, setDay] = useState('');
  useEffect(() => setDay(todayKey()), []);
  return <NotesScreen ready={Boolean(day)} todayKey={day} />;
}
