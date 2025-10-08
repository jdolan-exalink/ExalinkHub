"use client";

import type { FrigateServer } from '@/lib/types';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Server, Globe, Edit, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

type ServerCardProps = {
  server: FrigateServer;
  onEdit: () => void;
  onDelete: () => void;
};

export default function ServerCard({ server, onEdit, onDelete }: ServerCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
                <div className="p-3 bg-secondary rounded-lg">
                    <Server className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <CardTitle className="font-headline">{server.name}</CardTitle>
                    <CardDescription>Frigate Instance</CardDescription>
                </div>
            </div>
            <Badge variant="outline" className="text-green-500 border-green-500">
                Online
            </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-grow">
         <div className="text-sm text-muted-foreground space-y-2">
             <div className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                <span>{server.url}:{server.port}</span>
             </div>
         </div>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Edit className="h-4 w-4" />
          <span className="sr-only">Edit Server</span>
        </Button>
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="icon">
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete Server</span>
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the server connection for <span className="font-bold">{server.name}</span>.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}
