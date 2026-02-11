'use client';

import { useState } from 'react';
import axios from 'axios';

export default function APITestPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testAPI = async () => {
    console.log('🧪 TEST: Starting API test...');
    setLoading(true);
    setResult('Testing...');

    try {
      console.log('🧪 TEST: Making request to http://localhost:3001/api/v1/auth/login');

      const response = await axios.post('http://localhost:3001/api/v1/auth/login', {
        email: 'test@example.com',
        password: 'wrongpassword'
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        withCredentials: true
      });

      console.log('🧪 TEST: Response received:', response);
      setResult(`SUCCESS: ${JSON.stringify(response.data, null, 2)}`);
    } catch (error: any) {
      console.log('🧪 TEST: Error received:', error);
      if (error.response) {
        setResult(`RESPONSE ERROR (${error.response.status}): ${JSON.stringify(error.response.data, null, 2)}`);
      } else if (error.request) {
        setResult(`NO RESPONSE: Request was made but no response received. Check if backend is running on port 3001.`);
      } else {
        setResult(`REQUEST ERROR: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-8">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">API Connection Test</h1>

        <div className="space-y-4">
          <button
            onClick={testAPI}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-md font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? 'Testing...' : 'Test API Connection'}
          </button>

          {result && (
            <div className="mt-6">
              <h2 className="text-xl font-semibold mb-2">Result:</h2>
              <pre className="bg-gray-100 p-4 rounded border overflow-auto text-sm">
                {result}
              </pre>
            </div>
          )}

          <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded">
            <h3 className="font-semibold mb-2">What this tests:</h3>
            <ul className="list-disc list-inside text-sm space-y-1">
              <li>Can the frontend make HTTP requests?</li>
              <li>Is the backend reachable on port 3001?</li>
              <li>Is CORS configured correctly?</li>
              <li>Are network requests working?</li>
            </ul>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <p><strong>Expected result:</strong> Should show "RESPONSE ERROR (401): Invalid email or password"</p>
            <p className="mt-2"><strong>Check console:</strong> Press F12 and look for 🧪 TEST messages</p>
          </div>
        </div>
      </div>
    </div>
  );
}
