// Vercel API endpoint for RHB Send webhook
const Database = require('../../src/models/database');
const SMSService = require('../../src/utils/smsService');

// Initialize services
let database = null;
let smsService = null;

async function initializeServices() {
  if (!database) {
    database = new Database();
    await database.init();
  }
  if (!smsService) {
    smsService = new SMSService();
  }
}

export default async function handler(req, res) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    console.log('=== RHB SEND VERCEL WEBHOOK PROCESSING ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Headers:', req.headers);
    console.log('Full body:', req.body);

    const { From: phoneNumber, Body: messageBody, MessageSid } = req.body;
    console.log('Webhook received at RHB Send Vercel:', { phoneNumber, messageBody, MessageSid });

    if (!phoneNumber || !messageBody) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: From (phone number) and Body (message content)'
      });
    }

    // Initialize services
    await initializeServices();

    const result = await database.processInboundMessage(phoneNumber, messageBody);
    console.log('Database processing result:', result);

    if (result.handled) {
      // Send automated response
      if (result.responseMessage) {
        try {
          await smsService.sendSMS(phoneNumber, result.responseMessage);

          // Log the outbound response
          await database.logMessage(
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

      return res.json({
        success: true,
        data: {
          handled: true,
          response_keyword: result.responseKeyword,
          campaign_id: result.campaignId
        }
      });
    } else {
      return res.json({
        success: true,
        data: {
          handled: false,
          message: result.message
        }
      });
    }
  } catch (error) {
    console.error('Error processing inbound message:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process inbound message'
    });
  }
}