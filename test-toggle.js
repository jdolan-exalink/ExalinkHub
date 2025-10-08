const http = require('http');

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, {
      method: options.method || 'GET',
      headers: options.headers || {}
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ json: () => Promise.resolve(json) });
        } catch (e) {
          resolve({ json: () => Promise.resolve({}) });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function testToggle() {
  console.log('Testing toggle functionality...');

  try {
    // Get initial state
    const stateRes = await fetch('http://localhost:9002/api/conteo/state');
    const state = await stateRes.json();
    console.log('Initial state:', JSON.stringify(state, null, 2));

    if (!state.objetos || state.objetos.length === 0) {
      console.log('No objects to test');
      return;
    }

    // Toggle first object
    const firstObj = state.objetos[0];
    console.log('Toggling object:', firstObj);

    const toggleRes = await fetch('http://localhost:9002/api/conteo/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: firstObj })
    });

    const toggleResult = await toggleRes.json();
    console.log('Toggle result:', JSON.stringify(toggleResult, null, 2));

    // Get state again
    const stateRes2 = await fetch('http://localhost:9002/api/conteo/state');
    const state2 = await stateRes2.json();
    console.log('State after toggle:', JSON.stringify(state2, null, 2));

    // Check if all objects are still available
    const allObjectsStillAvailable = state.objetos.every(obj => state2.objetos.includes(obj));
    console.log('All objects still available:', allObjectsStillAvailable);

    // Check if the toggle actually worked
    const wasActive = state.activos.includes(firstObj);
    const isNowActive = state2.activos.includes(firstObj);
    const toggleWorked = wasActive !== isNowActive;

    console.log('Toggle worked correctly:', toggleWorked);

    if (allObjectsStillAvailable && toggleWorked) {
      console.log('✅ SUCCESS: Toggle works correctly and all objects remain visible');
    } else {
      console.log('❌ FAILURE: Toggle did not work as expected');
      if (!allObjectsStillAvailable) console.log('  - Objects disappeared');
      if (!toggleWorked) console.log('  - Toggle state did not change');
    }

  } catch (error) {
    console.error('Test failed:', error);
  }
}

testToggle();