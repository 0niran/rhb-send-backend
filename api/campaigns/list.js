// Vercel API endpoint for listing campaigns
const VercelDatabase = require('../../src/models/vercelDatabase');

// Initialize services globally to reuse across invocations
let database = null;

async function initializeServices() {
  if (!database) {
    database = new VercelDatabase();
    await database.init();
  }
}

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

    console.log('=== GET CAMPAIGNS LIST ===');

    // Initialize services
    await initializeServices();

    // Get all campaigns
    const campaigns = await database.getAllCampaigns();

    res.json({
      success: true,
      data: campaigns
    });

  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaigns'
    });
  }
};