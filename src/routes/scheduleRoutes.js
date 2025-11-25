const express = require('express');
const router = express.Router();

// Schedule routes will be set up by the main app
// This file is required to organize routes

module.exports = (scheduleController) => {
  // Create a new scheduled message
  router.post('/create', (req, res) => {
    scheduleController.createScheduledMessage(req, res);
  });

  // Get all scheduled messages
  router.get('/list', (req, res) => {
    scheduleController.getScheduledMessages(req, res);
  });

  // Cancel a scheduled message
  router.put('/cancel/:scheduleId', (req, res) => {
    scheduleController.cancelScheduledMessage(req, res);
  });

  // Delete a scheduled message
  router.delete('/delete/:scheduleId', (req, res) => {
    scheduleController.deleteScheduledMessage(req, res);
  });

  // Get pending messages (for processing)
  router.get('/pending', (req, res) => {
    scheduleController.getPendingMessages(req, res);
  });

  // Process pending messages (send them)
  router.post('/process', (req, res) => {
    scheduleController.processPendingMessages(req, res);
  });

  return router;
};