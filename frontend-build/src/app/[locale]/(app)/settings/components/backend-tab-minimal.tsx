'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function BackendTab() {
  const translate = useTranslations('settings.backend');
  const translate_common = useTranslations('common');
  
  const [saving, setSaving] = useState(false);

  const loadBackendConfig = async () => {
    // Implementación simple
  };

  const handleSave = async () => {
    // Implementación simple
  };

  return (
    <div className="space-y-6">
      <h1>Backend Configuration</h1>
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={loadBackendConfig}>
          {translate('reset')}
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? translate_common('loading') : translate('save_config')}
        </Button>
      </div>
    </div>
  );
}