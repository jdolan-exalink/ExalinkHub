"use client";

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';

interface SaveViewDialogProps {
  onSave: (name: string) => void;
  children?: React.ReactNode;
}

export default function SaveViewDialog({ onSave, children }: SaveViewDialogProps) {
  const translate = useTranslations('save_view_dialog');
  const [open, setOpen] = useState(false);
  const [viewName, setViewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!viewName.trim()) return;
    
    setIsLoading(true);
    try {
      await onSave(viewName.trim());
      setOpen(false);
      setViewName('');
    } catch (error) {
      console.error('Error saving view:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setViewName('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <Save className="h-4 w-4 mr-2" />
            {translate('save')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{translate('title')}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="view-name">
              {translate('name_label')}
            </Label>
            <Input
              id="view-name"
              placeholder={translate('name_placeholder')}
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && viewName.trim()) {
                  handleSave();
                }
              }}
              autoFocus
            />
          </div>
        </div>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            {translate('cancel')}
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!viewName.trim() || isLoading}
          >
            {isLoading ? translate('saving') : translate('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}