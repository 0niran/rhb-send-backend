const express = require('express');
const RSVPController = require('../controllers/rsvpController');

const router = express.Router();

// Initialize controller
const rsvpController = new RSVPController();

// Initialize controller on module load
(async () => {
  try {
    await rsvpController.init();
    console.log('RSVP routes initialized');
  } catch (error) {
    console.error('Failed to initialize RSVP controller:', error);
  }
})();

// Routes

// Health check
router.get('/health', async (req, res) => {
  await rsvpController.healthCheck(req, res);
});

// Send RSVP request to a single newcomer
router.post('/send-rsvp', async (req, res) => {
  await rsvpController.sendRsvpRequest(req, res);
});

// Send bulk RSVP requests
router.post('/send-bulk-rsvp', async (req, res) => {
  await rsvpController.sendBulkRsvpRequests(req, res);
});

// Twilio webhook endpoint for incoming SMS
router.post('/webhook', async (req, res) => {
  await rsvpController.handleIncomingSMS(req, res);
});

// Get RSVP status for specific phone number
router.get('/status/:phoneNumber', async (req, res) => {
  await rsvpController.getRsvpStatus(req, res);
});

// Get all RSVP records (with optional status filter)
router.get('/all', async (req, res) => {
  await rsvpController.getAllRsvps(req, res);
});

// Send reminders to pending RSVPs
router.post('/send-reminders', async (req, res) => {
  await rsvpController.sendReminders(req, res);
});

// Campaign Management Routes

// Validate campaign name availability
router.get('/validate-campaign/:campaignName', async (req, res) => {
  await rsvpController.validateCampaignName(req, res);
});

// Get all campaigns
router.get('/campaigns', async (req, res) => {
  await rsvpController.getAllCampaigns(req, res);
});

// Send bulk RSVP with campaign tracking (enhanced version)
router.post('/send-bulk-rsvp-with-campaign', async (req, res) => {
  await rsvpController.sendBulkRsvpRequestsWithCampaign(req, res);
});

// Dashboard Routes

// Sync message statuses from Twilio API
router.post('/dashboard/sync-message-statuses', async (req, res) => {
  await rsvpController.syncMessageStatuses(req, res);
});

// Get comprehensive dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
  await rsvpController.getDashboardStats(req, res);
});

// Get recent messages from Twilio API
router.get('/dashboard/twilio-recent-messages', async (req, res) => {
  await rsvpController.getTwilioRecentMessages(req, res);
});

module.exports = router;