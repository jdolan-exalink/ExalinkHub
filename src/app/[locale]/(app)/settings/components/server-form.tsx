"use client";

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import type { FrigateServer } from '@/lib/types';
import { useState } from 'react';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';

type FrigateServerFormData = FrigateServer & {
  protocol?: 'http' | 'https';
  port?: number;
  username?: string;
  password?: string;
  enabled?: boolean;
};

const serverSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  url: z.string().min(1, 'URL or IP Address is required'),
  port: z.coerce.number().min(1, 'Port is required').max(65535),
  apiKey: z.string().optional(),
});

type ServerFormValues = z.infer<typeof serverSchema>;

type ServerFormProps = {
  onSubmit: (data: any) => void;
  initialData?: FrigateServerFormData;
};

export default function ServerForm({ onSubmit, initialData }: ServerFormProps) {
  const { toast } = useToast();
  const [isTesting, setIsTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);

  const form = useForm<ServerFormValues>({
    resolver: zodResolver(serverSchema),
    defaultValues: {
      name: initialData?.name || '',
      url: initialData?.url || '',
      port: initialData?.port || 5000,
      apiKey: '',
    },
  });

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestSuccess(null);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));
    const success = Math.random() > 0.3; // Simulate success/failure
    setIsTesting(false);
    setTestSuccess(success);

    toast({
      title: success ? 'Connection Successful' : 'Connection Failed',
      description: success ? 'Successfully connected to the Frigate server.' : 'Could not connect to the server. Please check details.',
      variant: success ? 'default' : 'destructive',
    });
  };
  
  const onFormSubmit = (data: ServerFormValues) => {
    onSubmit({ id: initialData?.id, ...data });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onFormSubmit)} className="space-y-4 py-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Server Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., Main House" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex gap-2">
            <FormField
            control={form.control}
            name="url"
            render={({ field }) => (
                <FormItem className="flex-grow">
                <FormLabel>Host / IP Address</FormLabel>
                <FormControl>
                    <Input placeholder="192.168.1.100" {...field} />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
            <FormField
            control={form.control}
            name="port"
            render={({ field }) => (
                <FormItem>
                <FormLabel>Port</FormLabel>
                <FormControl>
                    <Input type="number" placeholder="5000" {...field} className="w-24" />
                </FormControl>
                <FormMessage />
                </FormItem>
            )}
            />
        </div>
        <FormField
          control={form.control}
          name="apiKey"
          render={({ field }) => (
            <FormItem>
              <FormLabel>API Token (Optional)</FormLabel>
              <FormControl>
                <Input type="password" placeholder="Enter API Token if required" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-between items-center gap-2 pt-4">
          <Button type="button" variant="outline" onClick={handleTestConnection} disabled={isTesting}>
            {isTesting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                testSuccess === true ? <CheckCircle className="mr-2 h-4 w-4 text-green-500" /> :
                testSuccess === false ? <AlertTriangle className="mr-2 h-4 w-4 text-red-500" /> : null
            )}
            Test Connection
          </Button>
          <Button type="submit">{initialData ? 'Save Changes' : 'Add Server'}</Button>
        </div>
      </form>
    </Form>
  );
}