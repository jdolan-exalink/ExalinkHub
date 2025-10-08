import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('=== FRIGATE DEBUG ENDPOINT ===');
    
    // Test 1: Basic network connectivity
    console.log('1. Testing basic network connectivity...');
    try {
      const basicTest = await fetch('http://10.1.1.252:5000', { 
        method: 'HEAD',
        signal: AbortSignal.timeout(5000)
      });
      console.log('✅ Basic connectivity OK:', basicTest.status);
    } catch (e) {
      console.log('❌ Basic connectivity FAILED:', e);
      return NextResponse.json({
        step: 'basic_connectivity',
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
        suggestion: 'Check if Frigate is running on http://10.1.1.252:5000'
      });
    }

    // Test 2: Frigate API version endpoint
    console.log('2. Testing Frigate API version endpoint...');
    try {
      const versionTest = await fetch('http://10.1.1.252:5000/api/version', {
        signal: AbortSignal.timeout(5000)
      });
      const versionData = await versionTest.json();
      console.log('✅ Version API OK:', versionData);
    } catch (e) {
      console.log('❌ Version API FAILED:', e);
      return NextResponse.json({
        step: 'version_api',
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
        suggestion: 'Frigate API not responding correctly'
      });
    }

    // Test 3: Frigate config endpoint
    console.log('3. Testing Frigate config endpoint...');
    try {
      const configTest = await fetch('http://10.1.1.252:5000/api/config', {
        signal: AbortSignal.timeout(5000)
      });
      const configData = await configTest.json();
      console.log('✅ Config API OK, cameras found:', Object.keys(configData.cameras || {}));
    } catch (e) {
      console.log('❌ Config API FAILED:', e);
      return NextResponse.json({
        step: 'config_api',
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
        suggestion: 'Frigate config endpoint not working'
      });
    }

    // All tests passed
    return NextResponse.json({
      success: true,
      message: 'All Frigate connectivity tests passed',
      server: 'http://10.1.1.252:5000'
    });

  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json({
      step: 'general_error',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}