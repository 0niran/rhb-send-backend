const SMSService = require('./smsService');

class ResponseProcessor {
  constructor(database) {
    this.db = database;
    this.smsService = new SMSService();
  }

  // Process incoming SMS response
  async processResponse(phoneNumber, messageBody, messageSid) {
    try {
      console.log(`Processing response from ${phoneNumber}: "${messageBody}"`);

      // Log the incoming message
      await this.db.logMessage(phoneNumber, 'inbound', messageBody, messageSid, 'received');

      // Get existing RSVP record
      const rsvpRecord = await this.db.getRsvpByPhoneNumber(phoneNumber);

      if (!rsvpRecord) {
        console.log(`No RSVP record found for ${phoneNumber}`);
        await this.sendUnrecognizedResponse(phoneNumber);
        return { success: false, message: 'No RSVP record found' };
      }

      // Increment response count
      await this.db.incrementResponseCount(phoneNumber);

      // Check if already responded
      if (rsvpRecord.rsvp_status !== 'pending') {
        console.log(`${phoneNumber} has already responded with: ${rsvpRecord.rsvp_status}`);
        await this.sendAlreadyRespondedMessage(phoneNumber, rsvpRecord);
        return { success: true, message: 'Already responded', status: rsvpRecord.rsvp_status };
      }

      // Parse the response
      const responseType = this.parseResponse(messageBody);
      console.log(`Parsed response type: ${responseType}`);

      // Process based on response type
      switch (responseType) {
        case 'yes':
          return await this.handleYesResponse(phoneNumber, rsvpRecord, messageSid);

        case 'no':
          return await this.handleNoResponse(phoneNumber, rsvpRecord, messageSid);

        case 'invalid':
          return await this.handleInvalidResponse(phoneNumber, rsvpRecord, messageSid);

        default:
          return await this.handleInvalidResponse(phoneNumber, rsvpRecord, messageSid);
      }

    } catch (error) {
      console.error('Error processing response:', error);
      await this.sendErrorMessage(phoneNumber);
      return { success: false, error: error.message };
    }
  }

  // Parse incoming message to determine response type
  parseResponse(messageBody) {
    if (!messageBody || typeof messageBody !== 'string') {
      return 'invalid';
    }

    const cleanMessage = messageBody.trim().toLowerCase();

    // Check for YES responses
    const yesPatterns = [
      /^yes$/i,
      /^y$/i,
      /^yeah$/i,
      /^yep$/i,
      /^yup$/i,
      /^sure$/i,
      /^ok$/i,
      /^okay$/i,
      /^confirm$/i,
      /^confirmed$/i,
      /^accept$/i,
      /^attending$/i,
      /^will attend$/i,
      /^count me in$/i,
      /^i'll be there$/i,
      /^i will be there$/i
    ];

    // Check for NO responses
    const noPatterns = [
      /^no$/i,
      /^n$/i,
      /^nope$/i,
      /^nah$/i,
      /^decline$/i,
      /^declined$/i,
      /^cannot$/i,
      /^can't$/i,
      /^unable$/i,
      /^not attending$/i,
      /^won't attend$/i,
      /^will not attend$/i,
      /^can't make it$/i,
      /^cannot make it$/i
    ];

    // Check YES patterns
    for (const pattern of yesPatterns) {
      if (pattern.test(cleanMessage)) {
        return 'yes';
      }
    }

    // Check NO patterns
    for (const pattern of noPatterns) {
      if (pattern.test(cleanMessage)) {
        return 'no';
      }
    }

    return 'invalid';
  }

  // Handle YES response
  async handleYesResponse(phoneNumber, rsvpRecord, messageSid) {
    try {
      // Update RSVP status to 'yes'
      await this.db.updateRsvpStatus(phoneNumber, 'yes');

      // Get campaign details for custom messages
      const campaign = await this.db.getCampaignByEventName(rsvpRecord.event_name);

      // Send confirmation message
      const response = await this.smsService.sendConfirmationMessage(
        phoneNumber,
        rsvpRecord.first_name || 'there',
        rsvpRecord.event_name || 'our event',
        campaign?.yes_response || null
      );

      // Log outbound message
      await this.db.logMessage(
        phoneNumber,
        'outbound',
        response.body,
        response.sid,
        response.status
      );

      console.log(`YES response processed for ${phoneNumber}`);

      return {
        success: true,
        status: 'yes',
        message: 'Confirmation sent',
        messageSid: response.sid
      };

    } catch (error) {
      console.error('Error handling YES response:', error);
      throw error;
    }
  }

  // Handle NO response
  async handleNoResponse(phoneNumber, rsvpRecord, messageSid) {
    try {
      // Update RSVP status to 'no'
      await this.db.updateRsvpStatus(phoneNumber, 'no');

      // Get campaign details for custom messages
      const campaign = await this.db.getCampaignByEventName(rsvpRecord.event_name);

      // Send decline acknowledgment
      const response = await this.smsService.sendDeclineAcknowledgment(
        phoneNumber,
        rsvpRecord.first_name || 'there',
        rsvpRecord.event_name || 'our event',
        campaign?.no_response || null
      );

      // Log outbound message
      await this.db.logMessage(
        phoneNumber,
        'outbound',
        response.body,
        response.sid,
        response.status
      );

      console.log(`NO response processed for ${phoneNumber}`);

      return {
        success: true,
        status: 'no',
        message: 'Decline acknowledgment sent',
        messageSid: response.sid
      };

    } catch (error) {
      console.error('Error handling NO response:', error);
      throw error;
    }
  }

  // Handle invalid response
  async handleInvalidResponse(phoneNumber, rsvpRecord, messageSid) {
    try {
      // Check if this is their first invalid response
      const maxInvalidResponses = 3;

      if (rsvpRecord.response_count >= maxInvalidResponses) {
        // Too many invalid responses, send final help message
        await this.sendFinalHelpMessage(phoneNumber, rsvpRecord.first_name);
        return {
          success: true,
          status: 'invalid',
          message: 'Final help message sent - max attempts reached'
        };
      }

      // Get campaign details for custom messages
      const campaign = await this.db.getCampaignByEventName(rsvpRecord.event_name);

      // Send help message
      const response = await this.smsService.sendHelpMessage(
        phoneNumber,
        rsvpRecord.first_name || 'there',
        campaign?.invalid_response || null
      );

      // Log outbound message
      await this.db.logMessage(
        phoneNumber,
        'outbound',
        response.body,
        response.sid,
        response.status
      );

      console.log(`Invalid response help message sent to ${phoneNumber}`);

      return {
        success: true,
        status: 'invalid',
        message: 'Help message sent',
        messageSid: response.sid
      };

    } catch (error) {
      console.error('Error handling invalid response:', error);
      throw error;
    }
  }

  // Send message when no RSVP record is found
  async sendUnrecognizedResponse(phoneNumber) {
    try {
      const message = `Hello! We don't have you on our RSVP list for any upcoming events. If you believe this is an error, please contact us directly. Thank you!`;

      const response = await this.smsService.sendSMS(phoneNumber, message);

      // Log this message (no database record to associate with)
      console.log(`Unrecognized response message sent to ${phoneNumber}`);

      return response;
    } catch (error) {
      console.error('Error sending unrecognized response:', error);
      throw error;
    }
  }

  // Send message when person has already responded
  async sendAlreadyRespondedMessage(phoneNumber, rsvpRecord) {
    try {
      let message;
      if (rsvpRecord.rsvp_status === 'yes') {
        message = `Hi ${rsvpRecord.first_name}! You've already confirmed your attendance at ${rsvpRecord.event_name}. We're looking forward to seeing you there! 🎉`;
      } else {
        message = `Hi ${rsvpRecord.first_name}! You've already let us know you can't attend ${rsvpRecord.event_name}. Thank you for letting us know! 💙`;
      }

      const response = await this.smsService.sendSMS(phoneNumber, message);

      // Log outbound message
      await this.db.logMessage(
        phoneNumber,
        'outbound',
        response.body,
        response.sid,
        response.status
      );

      return response;
    } catch (error) {
      console.error('Error sending already responded message:', error);
      throw error;
    }
  }

  // Send final help message after max attempts
  async sendFinalHelpMessage(phoneNumber, firstName) {
    try {
      const message = `Hi ${firstName || 'there'}!\n\nWe've noticed you're having trouble responding to our RSVP. No worries!\n\nPlease contact us directly if you need assistance, or simply ignore this message if you prefer not to attend.\n\nThank you! 😊`;

      const response = await this.smsService.sendSMS(phoneNumber, message);

      console.log(`Final help message sent to ${phoneNumber}`);
      return response;
    } catch (error) {
      console.error('Error sending final help message:', error);
      throw error;
    }
  }

  // Send error message for system errors
  async sendErrorMessage(phoneNumber) {
    try {
      const message = `Sorry! We're experiencing technical difficulties processing your response. Please try again later or contact us directly. Thank you for your patience!`;

      const response = await this.smsService.sendSMS(phoneNumber, message);
      console.log(`Error message sent to ${phoneNumber}`);

      return response;
    } catch (error) {
      console.error('Error sending error message:', error);
      // Don't throw here to avoid infinite loop
    }
  }
}

module.exports = ResponseProcessor;