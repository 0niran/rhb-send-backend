// Vercel API root endpoint with documentation
module.exports = async function handler(req, res) {
  try {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    // Only allow GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    res.json({
      name: 'RHB Send - Internal SMS Tool',
      version: '1.0.0',
      description: 'Simple bulk SMS campaigns with response handling',
      status: 'running',
      timestamp: new Date().toISOString(),
      environment: 'production',
      endpoints: {
        health: 'GET /api/health',
        campaigns: {
          create: 'POST /api/campaigns/create',
          list: 'GET /api/campaigns/list',
          stats: 'GET /api/campaigns/stats',
          webhook: 'POST /api/webhook/inbound'
        }
      },
      features: [
        'Bulk SMS campaigns with CSV upload',
        'One-way and two-way messaging',
        'YES/NO/INVALID response handling',
        'Message scheduling',
        'Template management',
        '8-digit campaign ID tracking'
      ]
    });

  } catch (error) {
    console.error('Error in root endpoint:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};