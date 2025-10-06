"use client";

import { useState } from 'react';
import type { FrigateServer } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ServerForm from './server-form';
import ServerCard from './server-card';
import { PlusCircle } from 'lucide-react';

type ServerManagerProps = {
  initialServers: FrigateServer[];
};

export default function ServerManager({ initialServers }: ServerManagerProps) {
  const [servers, setServers] = useState<FrigateServer[]>(initialServers);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<FrigateServer | undefined>(undefined);

  const handleAddServer = (server: Omit<FrigateServer, 'id'>) => {
    const newServer = { ...server, id: `server-${Date.now()}` };
    setServers(prev => [...prev, newServer]);
    setIsFormOpen(false);
  };

  const handleUpdateServer = (server: FrigateServer) => {
    setServers(prev => prev.map(s => s.id === server.id ? server : s));
    setEditingServer(undefined);
    setIsFormOpen(false);
  };

  const handleDeleteServer = (id: string) => {
    setServers(prev => prev.filter(s => s.id !== id));
  };

  const handleEdit = (server: FrigateServer) => {
    setEditingServer(server);
    setIsFormOpen(true);
  }
  
  const handleOpenChange = (open: boolean) => {
    setIsFormOpen(open);
    if (!open) {
      setEditingServer(undefined);
    }
  }

  return (
    <div>
        <div className="flex justify-end mb-4">
            <Dialog open={isFormOpen} onOpenChange={handleOpenChange}>
                <DialogTrigger asChild>
                    <Button>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Server
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingServer ? 'Edit Server' : 'Add New Server'}</DialogTitle>
                        <DialogDescription>
                            Enter the details for your Frigate server instance.
                        </DialogDescription>
                    </DialogHeader>
                    <ServerForm 
                        onSubmit={editingServer ? handleUpdateServer : handleAddServer} 
                        initialData={editingServer}
                    />
                </DialogContent>
            </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {servers.map(server => (
            <ServerCard 
                key={server.id} 
                server={server}
                onEdit={() => handleEdit(server)}
                onDelete={() => handleDeleteServer(server.id)}
            />
            ))}
        </div>

        {servers.length === 0 && (
            <div className="text-center text-muted-foreground py-16 border-2 border-dashed rounded-lg">
                <p>No Frigate servers configured.</p>
                <p>Click 'Add Server' to get started.</p>
            </div>
        )}
    </div>
  );
}
