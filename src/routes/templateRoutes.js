const express = require('express');
const router = express.Router();

// Controller will be injected
let templateController = null;

// Initialize controller
function initializeTemplateController(controller) {
  templateController = controller;
}

// Template routes
router.post('/create', async (req, res) => {
  if (!templateController) {
    return res.status(500).json({ success: false, error: 'Template controller not initialized' });
  }
  await templateController.createTemplate(req, res);
});

router.get('/list', async (req, res) => {
  if (!templateController) {
    return res.status(500).json({ success: false, error: 'Template controller not initialized' });
  }
  await templateController.getTemplates(req, res);
});

router.get('/get/:templateId', async (req, res) => {
  if (!templateController) {
    return res.status(500).json({ success: false, error: 'Template controller not initialized' });
  }
  await templateController.getTemplateById(req, res);
});

router.post('/use/:templateId', async (req, res) => {
  if (!templateController) {
    return res.status(500).json({ success: false, error: 'Template controller not initialized' });
  }
  await templateController.useTemplate(req, res);
});

router.put('/update/:templateId', async (req, res) => {
  if (!templateController) {
    return res.status(500).json({ success: false, error: 'Template controller not initialized' });
  }
  await templateController.updateTemplate(req, res);
});

router.delete('/delete/:templateId', async (req, res) => {
  if (!templateController) {
    return res.status(500).json({ success: false, error: 'Template controller not initialized' });
  }
  await templateController.deleteTemplate(req, res);
});

module.exports = { router, initializeTemplateController };