// Vercel API endpoint for creating campaigns
const VercelDatabase = require('../../src/models/vercelDatabase');
const SMSService = require('../../src/utils/smsService');

// Initialize services globally to reuse across invocations
let database = null;
let smsService = null;

async function initializeServices() {
  if (!database) {
    database = new VercelDatabase();
    await database.init();
  }
  if (!smsService) {
    smsService = new SMSService();
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

    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('=== CAMPAIGN CREATION REQUEST ===');
    console.log('Request body:', req.body);

    // Initialize services
    await initializeServices();

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

    // Validation
    if (!campaign_name || !message_content || !sender_id || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: campaign_name, message_content, sender_id, and recipients'
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
      if (!recipient.phone_number) {
        invalidRecipients.push({ index, error: 'Missing phone number', recipient });
        return;
      }

      const cleanedPhoneNumber = smsService.formatPhoneNumber(recipient.phone_number);

      if (!smsService.isValidPhoneNumber(cleanedPhoneNumber)) {
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

    const campaign = await database.createCampaign(campaignData);

    // Add recipients to database
    await database.addCampaignRecipients(campaign.campaign_id, validRecipients);

    if (send_immediately) {
      // Send immediately (note: this will be limited in serverless environment)
      console.log('Sending campaign immediately...');
      // For now, just mark as sending - actual sending would need a queue system
      await database.updateCampaignStatus(campaign.campaign_id, 'sending');

      // In a full implementation, you'd trigger a separate background process
      // For this demo, we'll simulate immediate sending
    } else {
      // Schedule for later
      const scheduleData = {
        campaign_id: campaign.campaign_id,
        message_content: message_content,
        recipients: validRecipients,
        scheduled_date: scheduled_date,
        scheduled_time: scheduled_time,
        timezone: timezone || 'UTC'
      };

      await database.addScheduledMessage(scheduleData);
      await database.updateCampaignStatus(campaign.campaign_id, 'scheduled');
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
};