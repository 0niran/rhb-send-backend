const Database = require('../models/database');
const SMSService = require('../utils/smsService');

class CampaignController {
  constructor() {
    this.database = new Database();
    this.smsService = new SMSService();
    this.init();
  }

  async init() {
    try {
      await this.database.init();
      console.log('Campaign Controller initialized successfully');
    } catch (error) {
      console.error('Campaign Controller initialization failed:', error);
      throw error;
    }
  }

  // Create and send/schedule a bulk SMS campaign
  async createCampaign(req, res) {
    try {
      const {
        campaign_name,
        message_content,
        sender_id,
        response_mode,
        yes_response,
        no_response,
        invalid_response,
        recipients,
        send_immediately,
        scheduled_date,
        scheduled_time,
        timezone
      } = req.body;

      // Debug logging
      console.log('=== Campaign Creation Debug ===');
      console.log('campaign_name:', campaign_name);
      console.log('message_content:', message_content);
      console.log('sender_id:', sender_id);
      console.log('recipients:', recipients);
      console.log('recipients type:', typeof recipients);
      console.log('recipients length:', recipients?.length);
      console.log('is array?:', Array.isArray(recipients));

      // Validation
      if (!campaign_name || !message_content || !sender_id || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
        console.log('Validation failed:');
        console.log('- campaign_name?:', !!campaign_name);
        console.log('- message_content?:', !!message_content);
        console.log('- sender_id?:', !!sender_id);
        console.log('- recipients?:', !!recipients);
        console.log('- is Array?:', Array.isArray(recipients));
        console.log('- length > 0?:', recipients?.length > 0);

        return res.status(400).json({
          success: false,
          error: 'Missing required fields: campaign_name, message_content, sender_id, and recipients',
          debug: {
            campaign_name: !!campaign_name,
            message_content: !!message_content,
            sender_id: !!sender_id,
            recipients: !!recipients,
            isArray: Array.isArray(recipients),
            length: recipients?.length
          }
        });
      }

      // Validate response mode requirements
      if (response_mode === 'two-way') {
        if (!yes_response || !no_response || !invalid_response) {
          return res.status(400).json({
            success: false,
            error: 'Two-way mode requires yes_response, no_response, and invalid_response'
          });
        }
      }

      // Validate scheduling requirements
      if (!send_immediately && (!scheduled_date || !scheduled_time)) {
        return res.status(400).json({
          success: false,
          error: 'Scheduled campaigns require scheduled_date and scheduled_time'
        });
      }

      // Validate and clean recipients
      const validRecipients = [];
      const invalidRecipients = [];

      recipients.forEach((recipient, index) => {
        console.log(`Processing recipient ${index}:`, recipient); // Debug log

        if (!recipient.phone_number) {
          invalidRecipients.push({ index, error: 'Missing phone number', recipient });
          return;
        }

        const cleanedPhoneNumber = this.smsService.formatPhoneNumber(recipient.phone_number);
        console.log(`Formatted phone number: ${recipient.phone_number} -> ${cleanedPhoneNumber}`); // Debug log

        if (!this.smsService.isValidPhoneNumber(cleanedPhoneNumber)) {
          invalidRecipients.push({
            index,
            phone_number: recipient.phone_number,
            cleaned_phone_number: cleanedPhoneNumber,
            error: 'Invalid phone number format',
            recipient
          });
          return;
        }

        validRecipients.push({
          phone_number: cleanedPhoneNumber,
          first_name: recipient.first_name || '',
          last_name: recipient.last_name || ''
        });
      });

      console.log(`Validation results: ${validRecipients.length} valid, ${invalidRecipients.length} invalid`); // Debug log

      if (validRecipients.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid recipients found',
          invalid_recipients: invalidRecipients
        });
      }

      // Create campaign record
      const campaignData = {
        campaign_name,
        message_content,
        sender_id,
        response_mode: response_mode || 'one-way',
        yes_response: response_mode === 'two-way' ? yes_response : null,
        no_response: response_mode === 'two-way' ? no_response : null,
        invalid_response: response_mode === 'two-way' ? invalid_response : null,
        total_recipients: validRecipients.length,
        scheduled_date: send_immediately ? null : scheduled_date,
        scheduled_time: send_immediately ? null : scheduled_time,
        timezone: timezone || 'UTC'
      };

      const campaign = await this.database.createCampaign(campaignData);

      // Add recipients to database
      await this.database.addCampaignRecipients(campaign.campaign_id, validRecipients);

      if (send_immediately) {
        // Send immediately
        await this.sendCampaignNow(campaign.campaign_id, validRecipients, message_content);
      } else {
        // Schedule for later
        await this.scheduleCampaign(campaign.campaign_id, validRecipients, message_content, scheduled_date, scheduled_time, timezone);
      }

      res.status(201).json({
        success: true,
        data: {
          campaign_id: campaign.campaign_id,
          campaign_name: campaign.campaign_name,
          valid_recipients: validRecipients.length,
          invalid_recipients: invalidRecipients.length,
          status: send_immediately ? 'sending' : 'scheduled'
        },
        invalid_recipients: invalidRecipients.length > 0 ? invalidRecipients : undefined
      });

    } catch (error) {
      console.error('Error creating campaign:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create campaign'
      });
    }
  }

  // Send campaign immediately
  async sendCampaignNow(campaignId, recipients, messageContent) {
    try {
      let sentCount = 0;
      const errors = [];

      // Send messages in batches to avoid rate limiting
      const batchSize = 10;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        await Promise.allSettled(batch.map(async (recipient) => {
          // Personalize message for each recipient
          let personalizedMessage = messageContent;
          if (recipient.first_name) {
            // Support all common first name variations
            personalizedMessage = personalizedMessage.replace(/{firstName}/g, recipient.first_name);
            personalizedMessage = personalizedMessage.replace(/{FirstName}/g, recipient.first_name);
            personalizedMessage = personalizedMessage.replace(/{first_name}/g, recipient.first_name);
            personalizedMessage = personalizedMessage.replace(/{First name}/g, recipient.first_name);
            personalizedMessage = personalizedMessage.replace(/{First Name}/g, recipient.first_name);
            personalizedMessage = personalizedMessage.replace(/{FIRST_NAME}/g, recipient.first_name.toUpperCase());
            personalizedMessage = personalizedMessage.replace(/{FIRSTNAME}/g, recipient.first_name.toUpperCase());
          }
          if (recipient.last_name) {
            // Support all common last name variations
            personalizedMessage = personalizedMessage.replace(/{lastName}/g, recipient.last_name);
            personalizedMessage = personalizedMessage.replace(/{LastName}/g, recipient.last_name);
            personalizedMessage = personalizedMessage.replace(/{last_name}/g, recipient.last_name);
            personalizedMessage = personalizedMessage.replace(/{Last name}/g, recipient.last_name);
            personalizedMessage = personalizedMessage.replace(/{Last Name}/g, recipient.last_name);
            personalizedMessage = personalizedMessage.replace(/{LAST_NAME}/g, recipient.last_name.toUpperCase());
            personalizedMessage = personalizedMessage.replace(/{LASTNAME}/g, recipient.last_name.toUpperCase());
          }
          // Support for full name
          const fullName = `${recipient.first_name || ''} ${recipient.last_name || ''}`.trim();
          if (fullName) {
            personalizedMessage = personalizedMessage.replace(/{fullName}/g, fullName);
            personalizedMessage = personalizedMessage.replace(/{FullName}/g, fullName);
            personalizedMessage = personalizedMessage.replace(/{full_name}/g, fullName);
            personalizedMessage = personalizedMessage.replace(/{Full name}/g, fullName);
            personalizedMessage = personalizedMessage.replace(/{Full Name}/g, fullName);
            personalizedMessage = personalizedMessage.replace(/{FULL_NAME}/g, fullName.toUpperCase());
            personalizedMessage = personalizedMessage.replace(/{FULLNAME}/g, fullName.toUpperCase());
          }

          console.log(`Personalized message for ${recipient.first_name}: ${personalizedMessage}`); // Debug log

          try {
            const result = await this.smsService.sendSMS(
              recipient.phone_number,
              personalizedMessage,
              null // No callback URL for now
            );

            // Log successful message
            await this.database.logMessage(
              campaignId,
              recipient.phone_number,
              'outbound',
              personalizedMessage,
              result.sid,
              'sent'
            );

            // Update recipient status
            await this.database.updateRecipientStatus(
              campaignId,
              recipient.phone_number,
              'sent'
            );

            sentCount++;
          } catch (error) {
            console.error(`Failed to send to ${recipient.phone_number}:`, error);

            // Log failed message
            await this.database.logMessage(
              campaignId,
              recipient.phone_number,
              'outbound',
              personalizedMessage,
              null,
              'failed'
            );

            // Update recipient status
            await this.database.updateRecipientStatus(
              campaignId,
              recipient.phone_number,
              'failed'
            );

            errors.push({
              phone_number: recipient.phone_number,
              error: error.message
            });
          }
        }));

        // Small delay between batches
        if (i + batchSize < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update campaign status
      await this.database.updateCampaignStatus(campaignId, 'sent', sentCount);

      console.log(`Campaign ${campaignId}: Sent ${sentCount}/${recipients.length} messages`);

      return { sentCount, errors };
    } catch (error) {
      console.error('Error sending campaign:', error);
      await this.database.updateCampaignStatus(campaignId, 'failed');
      throw error;
    }
  }

  // Schedule campaign for later
  async scheduleCampaign(campaignId, recipients, messageContent, scheduledDate, scheduledTime, timezone) {
    try {
      const scheduleData = {
        campaign_id: campaignId,
        message_content: messageContent,
        recipients: recipients,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        timezone: timezone || 'UTC'
      };

      await this.database.addScheduledMessage(scheduleData);
      await this.database.updateCampaignStatus(campaignId, 'scheduled');

      console.log(`Campaign ${campaignId} scheduled for ${scheduledDate} ${scheduledTime} ${timezone}`);
    } catch (error) {
      console.error('Error scheduling campaign:', error);
      await this.database.updateCampaignStatus(campaignId, 'failed');
      throw error;
    }
  }

  // Get all campaigns
  async getAllCampaigns(req, res) {
    try {
      const campaigns = await this.database.getAllCampaigns();

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
  }

  // Get campaign details
  async getCampaignDetails(req, res) {
    try {
      const { campaignId } = req.params;

      const campaign = await this.database.getCampaignById(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: 'Campaign not found'
        });
      }

      const recipients = await this.database.getCampaignRecipients(campaignId);

      res.json({
        success: true,
        data: {
          campaign,
          recipients
        }
      });
    } catch (error) {
      console.error('Error fetching campaign details:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch campaign details'
      });
    }
  }

  // Get scheduled campaigns
  async getScheduledCampaigns(req, res) {
    try {
      const scheduledMessages = await this.database.getScheduledMessages();

      res.json({
        success: true,
        data: scheduledMessages
      });
    } catch (error) {
      console.error('Error fetching scheduled campaigns:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch scheduled campaigns'
      });
    }
  }

  // Cancel scheduled campaign
  async cancelScheduledCampaign(req, res) {
    try {
      const { scheduleId } = req.params;

      await this.database.updateScheduledMessageStatus(scheduleId, 'cancelled');

      res.json({
        success: true,
        message: 'Scheduled campaign cancelled successfully'
      });
    } catch (error) {
      console.error('Error cancelling scheduled campaign:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel scheduled campaign'
      });
    }
  }

  // Process inbound messages for two-way campaigns
  async processInboundMessage(req, res) {
    try {
      console.log('=== RHB SEND CAMPAIGN WEBHOOK PROCESSING ==='); // Debug log
      console.log('Timestamp:', new Date().toISOString()); // Debug log
      console.log('Headers:', req.headers); // Debug log
      console.log('Full body:', req.body); // Debug log
      const { From: phoneNumber, Body: messageBody, MessageSid } = req.body;
      console.log('Webhook received at RHB Send:', { phoneNumber, messageBody, MessageSid }); // Debug log

      if (!phoneNumber || !messageBody) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: From (phone number) and Body (message content)'
        });
      }

      const result = await this.database.processInboundMessage(phoneNumber, messageBody);
      console.log('Database processing result:', result); // Debug log

      if (result.handled) {
        // Send automated response
        if (result.responseMessage) {
          try {
            await this.smsService.sendSMS(phoneNumber, result.responseMessage);

            // Log the outbound response
            await this.database.logMessage(
              result.campaignId,
              phoneNumber,
              'outbound',
              result.responseMessage,
              null,
              'sent'
            );
          } catch (smsError) {
            console.error('Failed to send automated response:', smsError);
          }
        }

        res.json({
          success: true,
          data: {
            handled: true,
            response_keyword: result.responseKeyword,
            campaign_id: result.campaignId
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            handled: false,
            message: result.message
          }
        });
      }
    } catch (error) {
      console.error('Error processing inbound message:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process inbound message'
      });
    }
  }

  // Get campaign statistics
  async getCampaignStats(req, res) {
    try {
      const campaigns = await this.database.getAllCampaigns();
      const scheduledMessages = await this.database.getScheduledMessages();

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
  }
}

module.exports = CampaignController;