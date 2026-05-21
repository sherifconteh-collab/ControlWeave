const axios = require('./controlweave/backend/node_modules/axios');

const API_BASE_URL = 'https://controlweave-pro-production.up.railway.app/api/v1';
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

(async () => {
  try {
    console.log('1. Attempting login...');
    const response = await api.post('/auth/login', { email: 'admin@enterprise.com', password: 'ControlWeave!2026' });
    console.log('   Login success:', response.data.success);
    const { tokens } = response.data.data;
    console.log('   Got accessToken:', Boolean(tokens.accessToken));
    console.log('   Got refreshToken:', Boolean(tokens.refreshToken));

    console.log('\n2. Attempting /auth/me...');
    const meResponse = await axios.get(API_BASE_URL + '/auth/me', {
      headers: { Authorization: 'Bearer ' + tokens.accessToken }
    });
    console.log('   /me success:', meResponse.data.success);
    console.log('   /me data keys:', Object.keys(meResponse.data.data || {}));
    console.log('   Organization:', JSON.stringify(meResponse.data.data?.organization, null, 2));
    console.log('   is_platform_admin:', meResponse.data.data?.is_platform_admin);
    console.log('   onboarding_required:', meResponse.data.data?.onboarding_required);
    console.log('   roles:', meResponse.data.data?.roles);
  } catch (err) {
    console.log('ERROR at step:', err.config?.url);
    console.log('Status:', err.response?.status);
    console.log('Response:', JSON.stringify(err.response?.data));
    console.log('Message:', err.message);
  }
})();
