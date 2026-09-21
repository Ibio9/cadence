'use client';

import { useEffect, useState } from 'react';
import { todayKey } from '../../../lib/api';
import TimetableScreen from '../../../src/screens/TimetableScreen';

export default function TimetablePage() {
  // The day the timetable is looking at. Starts on today, then moves
  // independently. Resolved after mount so server and client agree.
  const [date, setDate] = useState('');
  useEffect(() => setDate(todayKey()), []);

  return <TimetableScreen date={date} onDateChange={setDate} />;
}
