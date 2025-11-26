// Vercel API endpoint for campaign statistics
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

    console.log('=== GET CAMPAIGN STATS ===');

    // Initialize services
    await initializeServices();

    // Get campaign statistics
    const campaigns = await database.getAllCampaigns();
    const scheduledMessages = await database.getScheduledMessages();

    const stats = {
      total_campaigns: campaigns.length,
      sent_campaigns: campaigns.filter(c => c.status === 'sent').length,
      pending_campaigns: campaigns.filter(c => c.status === 'pending').length,
      failed_campaigns: campaigns.filter(c => c.status === 'failed').length,
      scheduled_campaigns: scheduledMessages.length,
      total_messages_sent: campaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0),
      total_recipients: campaigns.reduce((sum, c) => sum + (c.total_recipients || 0), 0)
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error fetching campaign stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch campaign statistics'
    });
  }
};