const { createConnection } = require('mysql2/promise');

class VercelDatabase {
  constructor() {
    this.connection = null;
  }

  async init() {
    // Use environment variables for database connection
    const config = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'rhb_send',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      connectionLimit: 1
    };

    // For now, use in-memory storage for testing
    this.campaigns = new Map();
    this.recipients = new Map();
    this.messages = new Map();
    this.scheduledMessages = new Map();

    console.log('Vercel Database initialized (in-memory mode for testing)');
  }

  // Campaign methods
  async createCampaign(campaignData) {
    const campaignId = Date.now().toString();
    const campaign = {
      campaign_id: campaignId,
      ...campaignData,
      created_at: new Date().toISOString(),
      status: 'pending',
      sent_count: 0
    };

    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  async getCampaignById(campaignId) {
    return this.campaigns.get(campaignId) || null;
  }

  async getAllCampaigns() {
    return Array.from(this.campaigns.values());
  }

  async updateCampaignStatus(campaignId, status, sentCount = null) {
    const campaign = this.campaigns.get(campaignId);
    if (campaign) {
      campaign.status = status;
      if (sentCount !== null) {
        campaign.sent_count = sentCount;
      }
      campaign.updated_at = new Date().toISOString();
      this.campaigns.set(campaignId, campaign);
    }
  }

  // Recipient methods
  async addCampaignRecipients(campaignId, recipients) {
    recipients.forEach((recipient, index) => {
      const recipientId = `${campaignId}_${index}`;
      this.recipients.set(recipientId, {
        ...recipient,
        campaign_id: campaignId,
        recipient_id: recipientId,
        status: 'pending'
      });
    });
  }

  async getCampaignRecipients(campaignId) {
    return Array.from(this.recipients.values()).filter(r => r.campaign_id === campaignId);
  }

  async updateRecipientStatus(campaignId, phoneNumber, status) {
    const recipient = Array.from(this.recipients.values()).find(
      r => r.campaign_id === campaignId && r.phone_number === phoneNumber
    );
    if (recipient) {
      recipient.status = status;
      this.recipients.set(recipient.recipient_id, recipient);
    }
  }

  // Message logging
  async logMessage(campaignId, phoneNumber, direction, content, messageSid, status) {
    const messageId = Date.now() + Math.random().toString();
    const message = {
      message_id: messageId,
      campaign_id: campaignId,
      phone_number: phoneNumber,
      direction,
      content,
      message_sid: messageSid,
      status,
      created_at: new Date().toISOString()
    };

    this.messages.set(messageId, message);
    return message;
  }

  // Scheduled messages
  async addScheduledMessage(scheduleData) {
    const scheduleId = Date.now().toString();
    const scheduled = {
      schedule_id: scheduleId,
      ...scheduleData,
      status: 'pending',
      created_at: new Date().toISOString()
    };

    this.scheduledMessages.set(scheduleId, scheduled);
    return scheduled;
  }

  async getScheduledMessages() {
    return Array.from(this.scheduledMessages.values()).filter(s => s.status === 'pending');
  }

  async updateScheduledMessageStatus(scheduleId, status) {
    const scheduled = this.scheduledMessages.get(scheduleId);
    if (scheduled) {
      scheduled.status = status;
      this.scheduledMessages.set(scheduleId, scheduled);
    }
  }

  // Two-way SMS processing
  async processInboundMessage(phoneNumber, messageBody) {
    console.log('Processing inbound message:', { phoneNumber, messageBody });

    // Find the most recent campaign for this phone number
    const recipients = Array.from(this.recipients.values()).filter(r => r.phone_number === phoneNumber);

    if (recipients.length === 0) {
      console.log('No campaign found for phone number:', phoneNumber);
      return {
        handled: false,
        message: 'No active campaign found for this number'
      };
    }

    // Get the most recent campaign
    const mostRecentRecipient = recipients.sort((a, b) =>
      new Date(b.created_at || 0) - new Date(a.created_at || 0)
    )[0];

    const campaign = this.campaigns.get(mostRecentRecipient.campaign_id);

    if (!campaign || campaign.response_mode !== 'two-way') {
      console.log('Campaign not found or not two-way:', campaign?.response_mode);
      return {
        handled: false,
        message: 'Campaign does not support two-way responses'
      };
    }

    // Log the inbound message
    await this.logMessage(
      campaign.campaign_id,
      phoneNumber,
      'inbound',
      messageBody,
      null,
      'received'
    );

    // Process the response
    const normalizedBody = messageBody.toLowerCase().trim();
    let responseMessage = null;
    let responseKeyword = null;

    if (normalizedBody === 'yes' || normalizedBody === 'y') {
      responseMessage = campaign.yes_response;
      responseKeyword = 'yes';
    } else if (normalizedBody === 'no' || normalizedBody === 'n') {
      responseMessage = campaign.no_response;
      responseKeyword = 'no';
    } else {
      responseMessage = campaign.invalid_response;
      responseKeyword = 'invalid';
    }

    console.log('Generated response:', { responseKeyword, responseMessage });

    return {
      handled: true,
      campaignId: campaign.campaign_id,
      responseKeyword,
      responseMessage
    };
  }
}

module.exports = VercelDatabase;