"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Camera as CameraIcon, 
  Calendar,
  Clock,
  Database,
  AlertTriangle,
  CheckCircle,
  RefreshCw
} from 'lucide-react';

interface DiagnosticsProps {
  camera: string;
}

interface DiagnosticResult {
  success: boolean;
  camera: string;
  date_range?: {
    start: string;
    end: string;
    after_timestamp: number;
    before_timestamp: number;
  };
  recordings_found?: number;
  recordings?: Array<{
    id: string;
    start_time: number;
    end_time: number;
    start_iso: string;
    end_iso: string;
    duration: number;
    path: string;
  }>;
  timeline_data?: {
    segments: Array<{
      start_time: number;
      end_time: number;
      duration: number;
    }>;
  };
  error?: string;
  details?: string;
}

export default function RecordingDiagnostics({ camera }: DiagnosticsProps) {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const runDiagnostics = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/frigate/recordings/debug?camera=${encodeURIComponent(camera)}`);
      const data = await response.json();
      setDiagnostics(data);
      setLastUpdated(new Date());
    } catch (error) {
      setDiagnostics({
        success: false,
        camera,
        error: 'Failed to connect to diagnostics endpoint',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (camera) {
      runDiagnostics();
    }
  }, [camera]);

  const getStatusIcon = (success: boolean | undefined) => {
    if (success === true) return <CheckCircle className="h-4 w-4 text-green-500" />;
    if (success === false) return <AlertTriangle className="h-4 w-4 text-red-500" />;
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <CardTitle>Recording Diagnostics</CardTitle>
          {diagnostics && (
            <Badge variant={diagnostics.success ? "default" : "destructive"}>
              {diagnostics.success ? "Healthy" : "Issues"}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={runDiagnostics}
          disabled={isLoading}
          className="gap-1"
        >
          <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && (
          <div className="text-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Running diagnostics...</p>
          </div>
        )}

        {diagnostics && !isLoading && (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="recordings">Recordings</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      <CameraIcon className="h-4 w-4" />
                      <span className="font-medium">Camera</span>
                    </div>
                    <p className="text-lg font-bold">{diagnostics.camera}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(diagnostics.success)}
                      <span className="font-medium">Status</span>
                    </div>
                    <p className="text-lg font-bold">
                      {diagnostics.success ? "Connected" : "Error"}
                    </p>
                  </CardContent>
                </Card>

                {diagnostics.recordings_found !== undefined && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        <span className="font-medium">Recordings Found</span>
                      </div>
                      <p className="text-lg font-bold">{diagnostics.recordings_found}</p>
                    </CardContent>
                  </Card>
                )}

                {diagnostics.date_range && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="font-medium">Date Range</span>
                      </div>
                      <p className="text-sm">
                        {new Date(diagnostics.date_range.start).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {!diagnostics.success && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Error:</strong> {diagnostics.error}
                    {diagnostics.details && (
                      <div className="mt-2 text-xs">
                        <strong>Details:</strong> {diagnostics.details}
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="recordings" className="space-y-4">
              {diagnostics.recordings && diagnostics.recordings.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="font-medium">Available Recording Segments</h4>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {diagnostics.recordings.map((recording, index) => (
                      <Card key={recording.id} className="p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">{recording.id}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(recording.start_time * 1000).toLocaleTimeString()} - 
                              {new Date(recording.end_time * 1000).toLocaleTimeString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Duration: {Math.round(recording.duration / 60)}m
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            Segment {index + 1}
                          </Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No recordings found for the selected time range.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4">
              {diagnostics.timeline_data ? (
                <div className="space-y-4">
                  <h4 className="font-medium">Timeline Data</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Total Segments:</span>
                      <span className="font-medium">{diagnostics.timeline_data.segments.length}</span>
                    </div>
                    
                    {diagnostics.timeline_data.segments.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Segments:</p>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {diagnostics.timeline_data.segments.map((segment, index) => (
                            <div key={index} className="text-xs p-2 bg-gray-50 rounded">
                              <div>
                                {new Date(segment.start_time * 1000).toLocaleTimeString()} - 
                                {new Date(segment.end_time * 1000).toLocaleTimeString()}
                              </div>
                              <div className="text-muted-foreground">
                                Duration: {Math.round(segment.duration / 60)}m
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    No timeline data available.
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        )}

        {lastUpdated && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  );
}