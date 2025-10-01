import ServerManager from './components/server-manager';
import { SERVERS } from '@/lib/data';

export default function SettingsPage() {
  // In a real app, this data would be fetched from a database
  const servers = SERVERS;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold tracking-tight">Configuration</h1>
        <p className="text-muted-foreground">Manage connections to your Frigate servers.</p>
      </div>
      <ServerManager initialServers={servers} />
    </div>
  );
}
