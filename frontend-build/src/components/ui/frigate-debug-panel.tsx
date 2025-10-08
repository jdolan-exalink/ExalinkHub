"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface DebugResult {
  step?: string;
  success: boolean;
  error?: string;
  message?: string;
  suggestion?: string;
  server?: string;
}

export default function FrigateDebugPanel() {
  const [isDebugging, setIsDebugging] = useState(false);
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);

  const runDebugTest = async () => {
    setIsDebugging(true);
    setDebugResult(null);

    try {
      const response = await fetch('/api/frigate/debug');
      const result = await response.json();
      setDebugResult(result);
    } catch (error) {
      setDebugResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        step: 'network_error'
      });
    } finally {
      setIsDebugging(false);
    }
  };

  const testIndividualEndpoints = async () => {
    setIsDebugging(true);
    const endpoints = [
      { name: 'Status', url: '/api/frigate/status' },
      { name: 'Cameras', url: '/api/frigate/cameras' },
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Testing ${endpoint.name}...`);
        const response = await fetch(endpoint.url);
        const data = await response.json();
        console.log(`${endpoint.name} result:`, data);
      } catch (error) {
        console.error(`${endpoint.name} error:`, error);
      }
    }

    setIsDebugging(false);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Frigate Connection Debug
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runDebugTest} 
            disabled={isDebugging}
            variant="default"
          >
            {isDebugging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Run Connectivity Test
          </Button>
          
          <Button 
            onClick={testIndividualEndpoints} 
            disabled={isDebugging}
            variant="outline"
          >
            Test Individual APIs
          </Button>
        </div>

        {debugResult && (
          <Alert className={debugResult.success ? "border-green-500" : "border-red-500"}>
            <div className="flex items-center gap-2">
              {debugResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <AlertDescription>
                <div className="space-y-2">
                  {debugResult.success ? (
                    <div className="text-green-700">
                      ✅ {debugResult.message}
                    </div>
                  ) : (
                    <div className="text-red-700">
                      ❌ Error in step: <Badge variant="destructive">{debugResult.step}</Badge>
                      <br />
                      <strong>Error:</strong> {debugResult.error}
                      {debugResult.suggestion && (
                        <>
                          <br />
                          <strong>Suggestion:</strong> {debugResult.suggestion}
                        </>
                      )}
                    </div>
                  )}
                  
                  {debugResult.server && (
                    <div className="text-sm text-muted-foreground">
                      Server: {debugResult.server}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </div>
          </Alert>
        )}

        <div className="text-sm text-muted-foreground">
          <p><strong>Expected Server:</strong> http://10.1.1.252:5000</p>
          <p><strong>What this tests:</strong></p>
          <ul className="list-disc ml-4 space-y-1">
            <li>Basic network connectivity to Frigate server</li>
            <li>Frigate API version endpoint response</li>
            <li>Frigate configuration endpoint</li>
            <li>Camera data availability</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}