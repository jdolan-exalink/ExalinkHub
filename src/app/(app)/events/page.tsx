import EventDashboard from './components/event-dashboard';
import { EVENTS, CAMERAS } from '@/lib/data';

export default function EventsPage() {
  // In a real app, this data would be fetched from the Frigate API
  const events = EVENTS;
  const cameras = CAMERAS;
  
  return <EventDashboard initialEvents={events} cameras={cameras} />;
}
