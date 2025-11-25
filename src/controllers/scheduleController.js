const Database = require('../models/database');
const { v4: uuidv4 } = require('uuid');

class ScheduleController {
  constructor() {
    this.db = null;
  }

  // Initialize database connection
  async init() {
    this.db = new Database();
    await this.db.init();
    console.log('Schedule Controller initialized successfully');
  }

  // Create a new scheduled message
  async createScheduledMessage(req, res) {
    try {
      const {
        messageContent,
        recipients,
        scheduledDate,
        scheduledTime,
        timezone = 'UTC-05:00',
        scheduleType = 'once',
        recurrencePattern,
        campaignName
      } = req.body;

      // Validate required fields
      if (!messageContent || !recipients || !scheduledDate || !scheduledTime) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: 'messageContent, recipients, scheduledDate, and scheduledTime are required'
        });
      }

      if (!Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Invalid recipients',
          details: 'Recipients must be a non-empty array'
        });
      }

      // Generate unique schedule ID
      const scheduleId = uuidv4();

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(scheduledDate)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date format',
          details: 'Date must be in YYYY-MM-DD format'
        });
      }

      // Validate time format (HH:MM)
      const timeRegex = /^\d{2}:\d{2}$/;
      if (!timeRegex.test(scheduledTime)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid time format',
          details: 'Time must be in HH:MM format'
        });
      }

      // Check if scheduled time is in the future
      const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}:00`);
      const now = new Date();

      if (scheduledDateTime <= now) {
        return res.status(400).json({
          success: false,
          error: 'Invalid scheduled time',
          details: 'Scheduled time must be in the future'
        });
      }

      // Create scheduled message record
      const scheduleData = {
        scheduleId,
        messageContent,
        recipients,
        scheduledDate,
        scheduledTime,
        timezone,
        scheduleType,
        recurrencePattern,
        campaignName: campaignName || `Scheduled Message ${new Date().toISOString().split('T')[0]}`
      };

      const result = await this.db.addScheduledMessage(scheduleData);

      res.json({
        success: true,
        message: 'Message scheduled successfully',
        data: {
          scheduleId,
          scheduledFor: `${scheduledDate} ${scheduledTime} (${timezone})`,
          recipientCount: recipients.length,
          status: 'pending'
        }
      });

    } catch (error) {
      console.error('Error scheduling message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to schedule message',
        details: error.message
      });
    }
  }

  // Get all scheduled messages
  async getScheduledMessages(req, res) {
    try {
      const scheduledMessages = await this.db.getScheduledMessages();

      // Add formatted date/time and recipient count
      const formattedMessages = scheduledMessages.map(message => ({
        ...message,
        recipientCount: message.recipients.length,
        scheduledFor: `${message.scheduled_date} ${message.scheduled_time} (${message.timezone})`,
        formattedDate: new Date(`${message.scheduled_date}T${message.scheduled_time}:00`).toLocaleString()
      }));

      res.json({
        success: true,
        data: formattedMessages
      });

    } catch (error) {
      console.error('Error getting scheduled messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get scheduled messages',
        details: error.message
      });
    }
  }

  // Cancel a scheduled message
  async cancelScheduledMessage(req, res) {
    try {
      const { scheduleId } = req.params;

      if (!scheduleId) {
        return res.status(400).json({
          success: false,
          error: 'Missing schedule ID'
        });
      }

      const result = await this.db.cancelScheduledMessage(scheduleId);

      if (result.changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'Scheduled message not found'
        });
      }

      res.json({
        success: true,
        message: 'Scheduled message cancelled successfully',
        data: { scheduleId, status: 'cancelled' }
      });

    } catch (error) {
      console.error('Error cancelling scheduled message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel scheduled message',
        details: error.message
      });
    }
  }

  // Delete a scheduled message
  async deleteScheduledMessage(req, res) {
    try {
      const { scheduleId } = req.params;

      if (!scheduleId) {
        return res.status(400).json({
          success: false,
          error: 'Missing schedule ID'
        });
      }

      const result = await this.db.deleteScheduledMessage(scheduleId);

      if (result.changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'Scheduled message not found'
        });
      }

      res.json({
        success: true,
        message: 'Scheduled message deleted successfully',
        data: { scheduleId }
      });

    } catch (error) {
      console.error('Error deleting scheduled message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete scheduled message',
        details: error.message
      });
    }
  }

  // Get pending messages that should be sent now
  async getPendingMessages(req, res) {
    try {
      const pendingMessages = await this.db.getPendingScheduledMessages();

      res.json({
        success: true,
        data: pendingMessages,
        count: pendingMessages.length
      });

    } catch (error) {
      console.error('Error getting pending messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get pending messages',
        details: error.message
      });
    }
  }

  // Process pending messages (send them via SMS)
  async processPendingMessages(req, res) {
    try {
      const pendingMessages = await this.db.getPendingScheduledMessages();
      const results = [];

      for (const message of pendingMessages) {
        try {
          // Here you would integrate with your SMS service
          // For now, we'll just mark as sent
          console.log(`Processing scheduled message: ${message.schedule_id}`);
          console.log(`Recipients: ${message.recipients.length}`);
          console.log(`Content: ${message.message_content.substring(0, 50)}...`);

          // Update status to sent
          await this.db.updateScheduledMessageStatus(
            message.schedule_id,
            'sent',
            new Date().toISOString()
          );

          results.push({
            scheduleId: message.schedule_id,
            status: 'sent',
            recipientCount: message.recipients.length
          });

        } catch (messageError) {
          console.error(`Error processing message ${message.schedule_id}:`, messageError);

          await this.db.updateScheduledMessageStatus(
            message.schedule_id,
            'failed'
          );

          results.push({
            scheduleId: message.schedule_id,
            status: 'failed',
            error: messageError.message
          });
        }
      }

      res.json({
        success: true,
        message: `Processed ${pendingMessages.length} scheduled messages`,
        data: results
      });

    } catch (error) {
      console.error('Error processing pending messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process pending messages',
        details: error.message
      });
    }
  }
}

module.exports = ScheduleController;