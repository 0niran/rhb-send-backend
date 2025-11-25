const express = require('express');
const router = express.Router();

// Controller will be injected
let campaignController = null;

// Initialize controller
function initializeCampaignController(controller) {
  campaignController = controller;
}

// Campaign management routes
router.post('/create', async (req, res) => {
  if (!campaignController) {
    return res.status(500).json({ success: false, error: 'Campaign controller not initialized' });
  }
  await campaignController.createCampaign(req, res);
});

router.get('/list', async (req, res) => {
  if (!campaignController) {
    return res.status(500).json({ success: false, error: 'Campaign controller not initialized' });
  }
  await campaignController.getAllCampaigns(req, res);
});

router.get('/details/:campaignId', async (req, res) => {
  if (!campaignController) {
    return res.status(500).json({ success: false, error: 'Campaign controller not initialized' });
  }
  await campaignController.getCampaignDetails(req, res);
});

router.get('/stats', async (req, res) => {
  if (!campaignController) {
    return res.status(500).json({ success: false, error: 'Campaign controller not initialized' });
  }
  await campaignController.getCampaignStats(req, res);
});

// Scheduled campaigns
router.get('/scheduled', async (req, res) => {
  if (!campaignController) {
    return res.status(500).json({ success: false, error: 'Campaign controller not initialized' });
  }
  await campaignController.getScheduledCampaigns(req, res);
});

router.put('/scheduled/:scheduleId/cancel', async (req, res) => {
  if (!campaignController) {
    return res.status(500).json({ success: false, error: 'Campaign controller not initialized' });
  }
  await campaignController.cancelScheduledCampaign(req, res);
});

// Inbound message processing (for two-way campaigns)
router.post('/webhook/inbound', async (req, res) => {
  if (!campaignController) {
    return res.status(500).json({ success: false, error: 'Campaign controller not initialized' });
  }
  await campaignController.processInboundMessage(req, res);
});

module.exports = { router, initializeCampaignController };