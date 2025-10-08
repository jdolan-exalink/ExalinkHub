'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react'

interface DiagnosticResult {
  test: string
  status: 'success' | 'error' | 'warning' | 'loading'
  message: string
  details?: any
  duration?: number
}

export function FrigateDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [isRunning, setIsRunning] = useState(false)

  const runDiagnostics = async () => {
    setIsRunning(true)
    setDiagnostics([])

    const tests = [
      {
        name: 'Connection Test',
        endpoint: '/api/frigate/test',
        description: 'Direct connection test to Frigate server'
      },
      {
        name: 'Recordings Debug',
        endpoint: '/api/frigate/recordings/debug?camera=Portones',
        description: 'Check available recordings for today'
      },
      {
        name: 'Frigate Status',
        endpoint: '/api/frigate/status',
        description: 'Check if Frigate server is responding'
      },
      {
        name: 'Frigate Stats',
        endpoint: '/api/frigate/stats',
        description: 'Check system statistics'
      },
      {
        name: 'Camera List',
        endpoint: '/api/frigate/cameras',
        description: 'List available cameras'
      },
      {
        name: 'Test Recording Stream',
        endpoint: '/api/frigate/recordings/stream?camera=Portones&date=2025-10-01&time=1727740800',
        description: 'Test recording endpoint with sample data'
      }
    ]

    for (const test of tests) {
      const startTime = Date.now()
      
      // Add loading state
      setDiagnostics(prev => [...prev, {
        test: test.name,
        status: 'loading',
        message: `Testing ${test.description}...`
      }])

      try {
        const response = await fetch(test.endpoint)
        const duration = Date.now() - startTime
        let result: DiagnosticResult

        if (response.ok) {
          const data = await response.text()
          let parsedData
          try {
            parsedData = JSON.parse(data)
          } catch {
            parsedData = data
          }

          result = {
            test: test.name,
            status: 'success',
            message: `✅ ${test.description} - OK (${response.status})`,
            details: parsedData,
            duration
          }
        } else {
          const errorText = await response.text()
          result = {
            test: test.name,
            status: 'error',
            message: `❌ ${test.description} - Failed (${response.status})`,
            details: errorText,
            duration
          }
        }

        // Update the loading entry
        setDiagnostics(prev => 
          prev.map(d => d.test === test.name ? result : d)
        )
      } catch (error) {
        const duration = Date.now() - startTime
        const result: DiagnosticResult = {
          test: test.name,
          status: 'error',
          message: `❌ ${test.description} - Network Error`,
          details: error instanceof Error ? error.message : 'Unknown error',
          duration
        }

        setDiagnostics(prev => 
          prev.map(d => d.test === test.name ? result : d)
        )
      }

      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    setIsRunning(false)
  }

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'loading':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    }
  }

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    const variants = {
      success: 'default',
      error: 'destructive', 
      warning: 'secondary',
      loading: 'outline'
    } as const

    return (
      <Badge variant={variants[status]}>
        {status.toUpperCase()}
      </Badge>
    )
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🔧 Frigate API Diagnostics
        </CardTitle>
        <CardDescription>
          Test connectivity and functionality of Frigate API endpoints
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostics} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Running Diagnostics...
            </>
          ) : (
            'Run Diagnostics'
          )}
        </Button>

        {diagnostics.length > 0 && (
          <div className="space-y-3">
            <Separator />
            <h3 className="font-semibold">Results:</h3>
            
            {diagnostics.map((result, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <span className="font-medium">{result.test}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {result.duration && (
                      <span className="text-xs text-gray-500">
                        {result.duration}ms
                      </span>
                    )}
                    {getStatusBadge(result.status)}
                  </div>
                </div>
                
                <p className="text-sm text-gray-600">{result.message}</p>
                
                {result.details && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
                      Show details
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-40">
                      {typeof result.details === 'string' 
                        ? result.details 
                        : JSON.stringify(result.details, null, 2)
                      }
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}