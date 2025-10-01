import RecordingBrowser from './components/recording-browser';
import { CAMERAS, EVENTS } from '@/lib/data';

export default function RecordingsPage() {
  // In a real app, this data would be fetched from the Frigate API
  const cameras = CAMERAS;
  const events = EVENTS;

  return <RecordingBrowser cameras={cameras} events={events} />;
}
