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

// Response reporting routes
router.get('/responses/summary', async (req, res) => {
  if (!campaignController) {
    return res.status(500).json({ success: false, error: 'Campaign controller not initialized' });
  }
  await campaignController.getResponseSummary(req, res);
});

router.get('/responses/all', async (req, res) => {
  if (!campaignController) {
    return res.status(500).json({ success: false, error: 'Campaign controller not initialized' });
  }
  await campaignController.getAllCampaignResponses(req, res);
});

router.get('/responses/export', async (req, res) => {
  if (!campaignController) {
    return res.status(500).json({ success: false, error: 'Campaign controller not initialized' });
  }
  await campaignController.exportResponsesToCSV(req, res);
});

router.get('/:campaignId/responses', async (req, res) => {
  if (!campaignController) {
    return res.status(500).json({ success: false, error: 'Campaign controller not initialized' });
  }
  await campaignController.getCampaignResponseReport(req, res);
});

router.get('/:campaignId/responses/:responseType', async (req, res) => {
  if (!campaignController) {
    return res.status(500).json({ success: false, error: 'Campaign controller not initialized' });
  }
  await campaignController.getResponsesByType(req, res);
});

module.exports = { router, initializeCampaignController };