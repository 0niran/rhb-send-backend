const Database = require('../models/database');
const SMSService = require('../utils/smsService');
const ResponseProcessor = require('../utils/responseProcessor');

class RSVPController {
  constructor() {
    this.db = new Database();
    this.smsService = new SMSService();
    this.responseProcessor = new ResponseProcessor(this.db);
  }

  // Initialize the controller
  async init() {
    try {
      await this.db.init();
      console.log('RSVP Controller initialized successfully');
    } catch (error) {
      console.error('Error initializing RSVP Controller:', error);
      throw error;
    }
  }

  // Send initial RSVP request to a newcomer
  async sendRsvpRequest(req, res) {
    try {
      const { phoneNumber, firstName, lastName, eventName } = req.body;

      // Validate required fields
      if (!phoneNumber || !firstName || !eventName) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: phoneNumber, firstName, and eventName are required'
        });
      }

      // Validate phone number format
      if (!this.smsService.isValidPhoneNumber(phoneNumber)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid phone number format'
        });
      }

      // Check if RSVP record already exists
      const existingRsvp = await this.db.getRsvpByPhoneNumber(phoneNumber);

      if (existingRsvp) {
        return res.status(409).json({
          success: false,
          error: 'RSVP already exists for this phone number',
          data: {
            phoneNumber,
            currentStatus: existingRsvp.rsvp_status,
            eventName: existingRsvp.event_name
          }
        });
      }

      // Add RSVP record to database
      await this.db.addRsvpRecord(phoneNumber, firstName, lastName, eventName);

      // Send RSVP request SMS
      const smsResult = await this.smsService.sendRsvpRequest(phoneNumber, firstName, eventName);

      // Log the outbound message
      await this.db.logMessage(
        phoneNumber,
        'outbound',
        smsResult.body,
        smsResult.sid,
        smsResult.status
      );

      console.log(`RSVP request sent successfully to ${phoneNumber}`);

      res.status(200).json({
        success: true,
        message: 'RSVP request sent successfully',
        data: {
          phoneNumber,
          firstName,
          eventName,
          messageSid: smsResult.sid,
          status: smsResult.status
        }
      });

    } catch (error) {
      console.error('Error sending RSVP request:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send RSVP request',
        details: error.message
      });
    }
  }

  // Handle incoming SMS webhook from Twilio
  async handleIncomingSMS(req, res) {
    try {
      // Extract data from Twilio webhook
      const { From: phoneNumber, Body: messageBody, MessageSid: messageSid } = req.body;

      // Clean and format phone number - fix common Twilio webhook issues
      const cleanPhoneNumber = this.smsService.formatPhoneNumber(phoneNumber?.toString().trim() || '');

      console.log(`Received SMS from ${phoneNumber} (cleaned: ${cleanPhoneNumber}): "${messageBody}"`);

      if (!cleanPhoneNumber || !messageBody) {
        console.error('Missing required webhook data');
        return res.status(400).send('Bad Request');
      }

      // Process the response
      const result = await this.responseProcessor.processResponse(
        cleanPhoneNumber,
        messageBody,
        messageSid
      );

      console.log(`Response processed:`, result);

      // Respond to Twilio (must respond with 200 status)
      res.status(200).send('OK');

    } catch (error) {
      console.error('Error handling incoming SMS:', error);

      // Still respond with 200 to Twilio to avoid retries
      res.status(200).send('Error processed');
    }
  }

  // Send bulk RSVP requests
  async sendBulkRsvpRequests(req, res) {
    try {
      const { recipients, eventName } = req.body;

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Recipients array is required and must not be empty'
        });
      }

      if (!eventName) {
        return res.status(400).json({
          success: false,
          error: 'Event name is required'
        });
      }

      const results = [];
      const errors = [];

      // Process each recipient
      for (const recipient of recipients) {
        try {
          const { phoneNumber, firstName, lastName } = recipient;

          if (!phoneNumber || !firstName) {
            errors.push({
              recipient,
              error: 'Missing phoneNumber or firstName'
            });
            continue;
          }

          // Check if already exists
          const existingRsvp = await this.db.getRsvpByPhoneNumber(phoneNumber);
          if (existingRsvp) {
            console.log(`Skipping ${phoneNumber} - RSVP already exists for ${existingRsvp.first_name} (status: ${existingRsvp.rsvp_status})`);
            errors.push({
              recipient,
              error: `RSVP already exists for this phone number (Current: ${existingRsvp.first_name} - ${existingRsvp.rsvp_status})`
            });
            continue;
          }

          // Add to database
          await this.db.addRsvpRecord(phoneNumber, firstName, lastName, eventName);

          // Send SMS
          console.log(`Attempting to send SMS to ${phoneNumber} for ${firstName} - Event: ${eventName}`);
          const smsResult = await this.smsService.sendRsvpRequest(phoneNumber, firstName, eventName);
          console.log(`SMS Result for ${phoneNumber}:`, smsResult);

          // Log message
          await this.db.logMessage(
            phoneNumber,
            'outbound',
            smsResult.body,
            smsResult.sid,
            smsResult.status
          );

          results.push({
            phoneNumber,
            firstName,
            messageSid: smsResult.sid,
            status: 'sent'
          });

          // Add small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          console.error(`Error sending to ${recipient.phoneNumber}:`, error);
          console.error(`Error details:`, {
            phoneNumber: recipient.phoneNumber,
            firstName: recipient.firstName,
            eventName,
            error: error.message,
            stack: error.stack
          });
          errors.push({
            recipient,
            error: error.message
          });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Bulk RSVP requests processed',
        data: {
          totalSent: results.length,
          totalErrors: errors.length,
          results,
          errors
        }
      });

    } catch (error) {
      console.error('Error sending bulk RSVP requests:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send bulk RSVP requests',
        details: error.message
      });
    }
  }

  // Get RSVP status for a specific phone number
  async getRsvpStatus(req, res) {
    try {
      const { phoneNumber } = req.params;

      if (!phoneNumber) {
        return res.status(400).json({
          success: false,
          error: 'Phone number is required'
        });
      }

      const rsvpRecord = await this.db.getRsvpByPhoneNumber(phoneNumber);

      if (!rsvpRecord) {
        return res.status(404).json({
          success: false,
          error: 'RSVP record not found'
        });
      }

      res.status(200).json({
        success: true,
        data: rsvpRecord
      });

    } catch (error) {
      console.error('Error getting RSVP status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get RSVP status',
        details: error.message
      });
    }
  }

  // Get all RSVP records with optional status filter
  async getAllRsvps(req, res) {
    try {
      const { status } = req.query;

      // Validate status if provided
      if (status && !['pending', 'yes', 'no'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status. Must be one of: pending, yes, no'
        });
      }

      const rsvps = await this.db.getAllRsvps(status);

      // Get summary statistics
      const summary = {
        total: rsvps.length,
        pending: rsvps.filter(r => r.rsvp_status === 'pending').length,
        confirmed: rsvps.filter(r => r.rsvp_status === 'yes').length,
        declined: rsvps.filter(r => r.rsvp_status === 'no').length
      };

      res.status(200).json({
        success: true,
        data: {
          rsvps,
          summary
        }
      });

    } catch (error) {
      console.error('Error getting all RSVPs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get RSVP records',
        details: error.message
      });
    }
  }

  // Send reminder to pending RSVPs
  async sendReminders(req, res) {
    try {
      const { eventName } = req.body;

      // Get all pending RSVPs
      const pendingRsvps = await this.db.getAllRsvps('pending');

      if (pendingRsvps.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No pending RSVPs found',
          data: { remindersSent: 0 }
        });
      }

      const results = [];
      const errors = [];

      // Send reminders
      for (const rsvp of pendingRsvps) {
        try {
          const smsResult = await this.smsService.sendReminder(
            rsvp.phone_number,
            rsvp.first_name,
            eventName || rsvp.event_name
          );

          // Log the reminder message
          await this.db.logMessage(
            rsvp.phone_number,
            'outbound',
            smsResult.body,
            smsResult.sid,
            smsResult.status
          );

          results.push({
            phoneNumber: rsvp.phone_number,
            firstName: rsvp.first_name,
            messageSid: smsResult.sid
          });

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          console.error(`Error sending reminder to ${rsvp.phone_number}:`, error);
          errors.push({
            phoneNumber: rsvp.phone_number,
            error: error.message
          });
        }
      }

      res.status(200).json({
        success: true,
        message: 'Reminders sent',
        data: {
          remindersSent: results.length,
          errors: errors.length,
          results,
          errors
        }
      });

    } catch (error) {
      console.error('Error sending reminders:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send reminders',
        details: error.message
      });
    }
  }

  // Health check endpoint
  async healthCheck(req, res) {
    try {
      // Test database connection
      await this.db.getAllRsvps();

      res.status(200).json({
        success: true,
        message: 'RSVP system is healthy',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        success: false,
        error: 'System health check failed',
        details: error.message
      });
    }
  }

  // Campaign Management Methods

  // Validate campaign name availability
  async validateCampaignName(req, res) {
    try {
      const { campaignName } = req.params;

      if (!campaignName) {
        return res.status(400).json({
          success: false,
          error: 'Campaign name is required'
        });
      }

      const validation = await this.db.validateCampaignName(campaignName);
      const existingCampaigns = validation.existingCampaign ? [validation.existingCampaign] : [];

      res.status(200).json({
        success: true,
        data: {
          isAvailable: validation.isAvailable,
          existingCampaigns
        }
      });

    } catch (error) {
      console.error('Error validating campaign name:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate campaign name',
        details: error.message
      });
    }
  }

  // Get all campaigns
  async getAllCampaigns(req, res) {
    try {
      const campaigns = await this.db.getAllCampaigns();

      res.status(200).json({
        success: true,
        data: {
          campaigns
        }
      });

    } catch (error) {
      console.error('Error getting campaigns:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get campaigns',
        details: error.message
      });
    }
  }

  // Enhanced send bulk RSVP with campaign tracking
  async sendBulkRsvpRequestsWithCampaign(req, res) {
    try {
      const {
        campaignId,
        campaignName,
        eventName,
        recipients,
        initialMessage,
        yesResponse,
        noResponse,
        invalidResponse
      } = req.body;

      // Validate required fields
      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Recipients array is required and must not be empty'
        });
      }

      if (!eventName) {
        return res.status(400).json({
          success: false,
          error: 'Event name is required'
        });
      }

      if (!campaignId || !campaignName) {
        return res.status(400).json({
          success: false,
          error: 'Campaign ID and campaign name are required'
        });
      }

      // Validate campaign name availability
      const nameValidation = await this.db.validateCampaignName(campaignName);
      if (!nameValidation.isAvailable) {
        return res.status(409).json({
          success: false,
          error: `Campaign name "${campaignName}" is already in use`,
          data: {
            existingCampaign: nameValidation.existingCampaign
          }
        });
      }

      // Create campaign record
      await this.db.createCampaign({
        campaignId,
        campaignName,
        eventName,
        initialMessage,
        yesResponse,
        noResponse,
        invalidResponse
      });

      const results = [];
      const errors = [];

      // Process each recipient
      for (const recipient of recipients) {
        try {
          const { phoneNumber, firstName, lastName } = recipient;

          if (!phoneNumber || !firstName) {
            errors.push({
              recipient,
              error: 'Missing phoneNumber or firstName'
            });
            continue;
          }

          // Validate phone number format
          if (!this.smsService.isValidPhoneNumber(phoneNumber)) {
            errors.push({
              recipient,
              error: 'Invalid phone number format'
            });
            continue;
          }

          console.log(`Attempting to send SMS to ${phoneNumber} for ${firstName} - Event: ${eventName}`);

          // Add RSVP record
          await this.db.addRsvpRecord(phoneNumber, firstName, lastName, eventName);

          // Send SMS
          const smsResult = await this.smsService.sendRsvpRequest(
            phoneNumber,
            firstName,
            eventName,
            initialMessage
          );

          results.push({
            phoneNumber,
            firstName,
            messageSid: smsResult.sid,
            status: smsResult.status
          });

          // Log message
          await this.db.logMessage(
            phoneNumber,
            'outbound',
            initialMessage,
            smsResult.sid,
            smsResult.status
          );

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));

        } catch (error) {
          console.error(`Error sending to ${recipient.phoneNumber}:`, error);
          errors.push({
            recipient,
            error: error.message
          });
        }
      }

      // Update campaign total sent
      await this.db.updateCampaignTotalSent(campaignId, results.length);

      res.status(200).json({
        success: true,
        message: 'Campaign sent successfully',
        data: {
          campaignId,
          campaignName,
          totalSent: results.length,
          totalErrors: errors.length,
          results,
          errors
        }
      });

    } catch (error) {
      console.error('Error sending campaign:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send campaign',
        details: error.message
      });
    }
  }

  // Dashboard Methods

  // Sync message statuses from Twilio
  async syncMessageStatuses(req, res) {
    try {
      // Get messages that need status updates
      const messagesToUpdate = await this.db.getMessagesForStatusUpdate();

      if (messagesToUpdate.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No messages to update',
          data: { updatedCount: 0 }
        });
      }

      console.log(`Syncing status for ${messagesToUpdate.length} messages`);

      const sids = messagesToUpdate.map(msg => msg.message_sid);

      // Get statuses from Twilio API
      const statusUpdates = await this.smsService.getMultipleMessageStatuses(sids);

      let updatedCount = 0;

      // Update each message status in the database
      for (const statusUpdate of statusUpdates) {
        try {
          await this.db.updateMessageStatus(
            statusUpdate.sid,
            statusUpdate.status,
            statusUpdate.errorCode,
            statusUpdate.errorMessage
          );
          updatedCount++;
        } catch (error) {
          console.warn(`Failed to update status for message ${statusUpdate.sid}:`, error.message);
        }
      }

      res.status(200).json({
        success: true,
        message: 'Message statuses synced',
        data: {
          totalChecked: messagesToUpdate.length,
          updatedCount,
          statusUpdates
        }
      });

    } catch (error) {
      console.error('Error syncing message statuses:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to sync message statuses',
        details: error.message
      });
    }
  }

  // Get comprehensive dashboard statistics
  async getDashboardStats(req, res) {
    try {
      // Get stats from database
      const stats = await this.db.getDashboardStats();

      // Calculate summary statistics
      const totalMessages = stats.totalMessages[0]?.count || 0;

      const messagesByStatus = {};
      stats.messagesByStatus.forEach(item => {
        messagesByStatus[item.status] = item.count;
      });

      // Format campaign summary with proper statistics
      const campaignSummary = stats.campaignSummary.map(campaign => ({
        campaignName: campaign.campaign_name,
        eventName: campaign.event_name,
        totalRecipients: campaign.total_recipients || 0,
        confirmed: campaign.confirmed || 0,
        declined: campaign.declined || 0,
        pending: campaign.pending || 0,
        responseRate: campaign.total_recipients > 0
          ? ((campaign.confirmed + campaign.declined) / campaign.total_recipients * 100).toFixed(1)
          : '0.0',
        confirmationRate: campaign.total_recipients > 0
          ? (campaign.confirmed / campaign.total_recipients * 100).toFixed(1)
          : '0.0',
        createdAt: campaign.created_at
      }));

      res.status(200).json({
        success: true,
        data: {
          overview: {
            totalMessages,
            totalCampaigns: campaignSummary.length,
            totalRecipients: campaignSummary.reduce((sum, c) => sum + c.totalRecipients, 0),
            totalConfirmed: campaignSummary.reduce((sum, c) => sum + c.confirmed, 0),
            totalDeclined: campaignSummary.reduce((sum, c) => sum + c.declined, 0),
            totalPending: campaignSummary.reduce((sum, c) => sum + c.pending, 0)
          },
          messagesByStatus,
          recentActivity: stats.recentActivity,
          campaignSummary
        }
      });

    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard statistics',
        details: error.message
      });
    }
  }

  // Get recent Twilio messages for dashboard insights
  async getTwilioRecentMessages(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;

      // Get recent messages from Twilio API
      const recentMessages = await this.smsService.getRecentMessages(limit);

      res.status(200).json({
        success: true,
        data: {
          messages: recentMessages,
          count: recentMessages.length
        }
      });

    } catch (error) {
      console.error('Error getting Twilio recent messages:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get recent messages from Twilio',
        details: error.message
      });
    }
  }
}

module.exports = RSVPController;