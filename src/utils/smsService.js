const twilio = require('twilio');

class SMSService {
  constructor() {
    this.client = null;
    this.init();
  }

  // Initialize Twilio client
  init() {
    try {
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
        console.warn('Twilio credentials not found in environment variables - running in demo mode');
        this.client = null;
        return;
      }

      // Check if using placeholder credentials
      if (process.env.TWILIO_ACCOUNT_SID.includes('xxx') ||
          process.env.TWILIO_AUTH_TOKEN === 'your_auth_token_here') {
        console.warn('Demo Twilio credentials detected - running in demo mode');
        console.warn('Update .env file with real Twilio credentials to send actual SMS messages');
        this.client = null;
        return;
      }

      console.log('Initializing Twilio with Account SID:', process.env.TWILIO_ACCOUNT_SID?.substring(0, 10) + '...');
      this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      console.log('Twilio SMS service initialized successfully');
    } catch (error) {
      console.error('Error initializing Twilio SMS service:', error.message);
      console.error('Error details:', error);
      console.warn('Running in demo mode - SMS messages will be logged instead of sent');
      this.client = null;
    }
  }

  // Send initial RSVP request SMS
  async sendRsvpRequest(phoneNumber, firstName, eventName, customMessage = null) {
    // Use custom message if provided, otherwise use default
    let message;
    if (customMessage) {
      // Replace template variables in custom message
      message = customMessage
        .replace(/{firstName}/g, firstName)
        .replace(/{eventName}/g, eventName);
    } else {
      // Fallback to default message
      message = `Hi ${firstName}! 🎉\n\nYou're invited to ${eventName}!\n\nPlease reply:\n• YES to confirm your attendance\n• NO if you can't make it\n\nWe look forward to seeing you!`;
    }

    try {
      const result = await this.sendSMS(phoneNumber, message);
      console.log(`RSVP request sent to ${phoneNumber}`);
      return result;
    } catch (error) {
      console.error(`Error sending RSVP request to ${phoneNumber}:`, error.message);
      throw error;
    }
  }

  // Send confirmation message for "YES" response
  async sendConfirmationMessage(phoneNumber, firstName, eventName, customMessage = null) {
    // Use custom message if provided, otherwise use default
    let message;
    if (customMessage) {
      // Replace template variables in custom message
      message = customMessage
        .replace(/{firstName}/g, firstName)
        .replace(/{eventName}/g, eventName);
    } else {
      // Fallback to default message
      message = `Thank you ${firstName}! ✅\n\nYour attendance at ${eventName} is confirmed!\n\nWe're excited to see you there. You'll receive more details closer to the event date.\n\nSee you soon! 🎉`;
    }

    try {
      const result = await this.sendSMS(phoneNumber, message);
      console.log(`Confirmation sent to ${phoneNumber}`);
      return result;
    } catch (error) {
      console.error(`Error sending confirmation to ${phoneNumber}:`, error.message);
      throw error;
    }
  }

  // Send acknowledgment message for "NO" response
  async sendDeclineAcknowledgment(phoneNumber, firstName, eventName, customMessage = null) {
    // Use custom message if provided, otherwise use default
    let message;
    if (customMessage) {
      // Replace template variables in custom message
      message = customMessage
        .replace(/{firstName}/g, firstName)
        .replace(/{eventName}/g, eventName);
    } else {
      // Fallback to default message
      message = `Thank you for letting us know, ${firstName}. 💙\n\nWe're sorry you can't make it to ${eventName}, but we understand.\n\nHope to see you at our next event!\n\nTake care! 😊`;
    }

    try {
      const result = await this.sendSMS(phoneNumber, message);
      console.log(`Decline acknowledgment sent to ${phoneNumber}`);
      return result;
    } catch (error) {
      console.error(`Error sending decline acknowledgment to ${phoneNumber}:`, error.message);
      throw error;
    }
  }

  // Send help message for invalid responses
  async sendHelpMessage(phoneNumber, firstName, customMessage = null) {
    // Use custom message if provided, otherwise use default
    let message;
    if (customMessage) {
      // Replace template variables in custom message
      message = customMessage
        .replace(/{firstName}/g, firstName);
    } else {
      // Fallback to default message
      message = `Hi ${firstName}! 🤔\n\nI didn't understand your response. Please reply with:\n\n• YES - to confirm your attendance\n• NO - if you can't make it\n\nJust text back one of these options. Thanks!`;
    }

    try {
      const result = await this.sendSMS(phoneNumber, message);
      console.log(`Help message sent to ${phoneNumber}`);
      return result;
    } catch (error) {
      console.error(`Error sending help message to ${phoneNumber}:`, error.message);
      throw error;
    }
  }

  // Send follow-up reminder (if needed)
  async sendReminder(phoneNumber, firstName, eventName) {
    const message = `Hi ${firstName}! 👋\n\nFriendly reminder: We're still waiting for your RSVP for ${eventName}.\n\nPlease reply:\n• YES to confirm\n• NO if you can't attend\n\nThanks!`;

    try {
      const result = await this.sendSMS(phoneNumber, message);
      console.log(`Reminder sent to ${phoneNumber}`);
      return result;
    } catch (error) {
      console.error(`Error sending reminder to ${phoneNumber}:`, error.message);
      throw error;
    }
  }

  // Generic SMS sending method
  async sendSMS(phoneNumber, message) {
    try {
      console.log(`SMS Service - Input phone number: "${phoneNumber}"`);

      // Demo mode - log instead of sending
      if (!this.client) {
        console.log('\n📱 [DEMO MODE] SMS would be sent:');
        console.log(`   To: ${phoneNumber}`);
        console.log(`   From: ${process.env.TWILIO_PHONE_NUMBER || '+1234567890'}`);
        console.log(`   Message: ${message}`);
        console.log('   Status: demo_sent\n');

        // Return mock response for demo mode
        return {
          sid: `demo_${Date.now()}`,
          status: 'demo_sent',
          to: this.formatPhoneNumber(phoneNumber),
          from: process.env.TWILIO_PHONE_NUMBER || '+1234567890',
          body: message
        };
      }

      // Ensure phone number is in international format
      const formattedNumber = this.formatPhoneNumber(phoneNumber);
      console.log(`SMS Service - Formatted phone number: "${formattedNumber}"`);

      console.log('🔄 Attempting to send SMS via Twilio API...');
      console.log('SMS Details:');
      console.log(`  - To: ${formattedNumber}`);
      console.log(`  - From: ${process.env.TWILIO_PHONE_NUMBER}`);
      console.log(`  - Message: ${message}`);
      console.log(`  - Account SID: ${process.env.TWILIO_ACCOUNT_SID?.substring(0, 10)}...`);

      let result;
      try {
        result = await this.client.messages.create({
          body: message,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: formattedNumber
        });

        console.log('✅ SMS sent successfully!');
        console.log('Twilio Response:');
        console.log(`  - SID: ${result.sid}`);
        console.log(`  - Status: ${result.status}`);
        console.log(`  - To: ${result.to}`);
        console.log(`  - From: ${result.from}`);
      } catch (twilioError) {
        console.error('❌ Twilio API Error:');
        console.error('  - Error Code:', twilioError.code);
        console.error('  - Error Message:', twilioError.message);
        console.error('  - More Info:', twilioError.moreInfo);
        console.error('  - Status:', twilioError.status);
        console.error('  - Stack:', twilioError.stack);
        throw twilioError;
      }

      return {
        sid: result.sid,
        status: result.status,
        to: result.to,
        from: result.from,
        body: result.body
      };
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  // Format phone number to international format
  formatPhoneNumber(phoneNumber) {
    // Remove all non-numeric characters
    let cleaned = phoneNumber.replace(/\D/g, '');

    // If it starts with 1 and is 11 digits, assume it's US/Canada
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+${cleaned}`;
    }

    // If it's 10 digits, assume US/Canada and add +1
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }

    // If it already has country code
    if (cleaned.length > 10) {
      return `+${cleaned}`;
    }

    // Default case - add +1 for US
    return `+1${cleaned}`;
  }

  // Validate phone number format
  isValidPhoneNumber(phoneNumber) {
    const cleaned = phoneNumber.replace(/\D/g, '');
    return cleaned.length >= 10 && cleaned.length <= 15;
  }

  // Get message status (if needed)
  async getMessageStatus(messageSid) {
    try {
      if (!this.client) {
        throw new Error('Twilio client not initialized');
      }

      const message = await this.client.messages(messageSid).fetch();
      return {
        sid: message.sid,
        status: message.status,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateUpdated: message.dateUpdated,
        dateSent: message.dateSent
      };
    } catch (error) {
      console.error('Error fetching message status:', error);
      throw error;
    }
  }

  // Get multiple message statuses for dashboard
  async getMultipleMessageStatuses(messageSids) {
    try {
      if (!this.client) {
        throw new Error('Twilio client not initialized');
      }

      const statusPromises = messageSids.map(async (sid) => {
        try {
          return await this.getMessageStatus(sid);
        } catch (error) {
          console.warn(`Failed to get status for message ${sid}:`, error.message);
          return {
            sid: sid,
            status: 'failed',
            errorCode: null,
            errorMessage: error.message
          };
        }
      });

      return await Promise.all(statusPromises);
    } catch (error) {
      console.error('Error fetching multiple message statuses:', error);
      throw error;
    }
  }

  // Get recent messages from Twilio API for dashboard insights
  async getRecentMessages(limit = 50) {
    try {
      if (!this.client) {
        throw new Error('Twilio client not initialized');
      }

      const messages = await this.client.messages.list({
        limit: limit
      });

      return messages.map(message => ({
        sid: message.sid,
        from: message.from,
        to: message.to,
        body: message.body,
        status: message.status,
        direction: message.direction,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
        dateSent: message.dateSent,
        dateUpdated: message.dateUpdated
      }));
    } catch (error) {
      console.error('Error fetching recent messages:', error);
      throw error;
    }
  }
}

module.exports = SMSService;