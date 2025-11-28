const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
  }

  // Initialize database connection and create tables
  async init() {
    return new Promise((resolve, reject) => {
      const dbPath = process.env.DB_PATH || './rhb_send_database.db';

      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables()
            .then(() => resolve())
            .catch(reject);
        }
      });
    });
  }

  // Generate 8-digit campaign ID
  generateCampaignId() {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  }

  // Create necessary tables for RHB Send
  async createTables() {
    return new Promise((resolve, reject) => {
      // Simplified campaigns table for RHB Send
      const createCampaignsTable = `
        CREATE TABLE IF NOT EXISTS campaigns (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id TEXT NOT NULL UNIQUE,
          campaign_name TEXT NOT NULL,
          message_content TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          response_mode TEXT CHECK(response_mode IN ('one-way', 'two-way')) DEFAULT 'one-way',
          yes_response TEXT,
          no_response TEXT,
          invalid_response TEXT,
          status TEXT CHECK(status IN ('pending', 'sent', 'failed', 'scheduled')) DEFAULT 'pending',
          total_recipients INTEGER DEFAULT 0,
          sent_count INTEGER DEFAULT 0,
          scheduled_date TEXT,
          scheduled_time TEXT,
          timezone TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Message log table (reused from existing system)
      const createMessageLogTable = `
        CREATE TABLE IF NOT EXISTS message_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id TEXT,
          phone_number TEXT NOT NULL,
          message_type TEXT CHECK(message_type IN ('outbound', 'inbound')) NOT NULL,
          message_content TEXT NOT NULL,
          message_sid TEXT,
          status TEXT,
          response_keyword TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(campaign_id) REFERENCES campaigns(campaign_id)
        )
      `;

      // Scheduled messages table (reused from existing system)
      const createScheduledMessagesTable = `
        CREATE TABLE IF NOT EXISTS scheduled_messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          schedule_id TEXT NOT NULL UNIQUE,
          campaign_id TEXT NOT NULL,
          message_content TEXT NOT NULL,
          recipients TEXT NOT NULL, -- JSON array of recipients
          scheduled_date TEXT NOT NULL,
          scheduled_time TEXT NOT NULL,
          timezone TEXT NOT NULL,
          status TEXT CHECK(status IN ('pending', 'sent', 'cancelled', 'failed')) DEFAULT 'pending',
          sent_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(campaign_id) REFERENCES campaigns(campaign_id)
        )
      `;

      // Message templates table (reused from existing system)
      const createTemplatesTable = `
        CREATE TABLE IF NOT EXISTS message_templates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          template_id TEXT NOT NULL UNIQUE,
          template_name TEXT NOT NULL,
          category TEXT NOT NULL,
          content TEXT NOT NULL,
          variables TEXT, -- JSON array of available variables
          description TEXT,
          usage_count INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Recipients table for tracking campaign recipients
      const createRecipientsTable = `
        CREATE TABLE IF NOT EXISTS campaign_recipients (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campaign_id TEXT NOT NULL,
          phone_number TEXT NOT NULL,
          first_name TEXT,
          last_name TEXT,
          message_status TEXT CHECK(message_status IN ('pending', 'sent', 'delivered', 'failed')) DEFAULT 'pending',
          response_keyword TEXT,
          response_received_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(campaign_id) REFERENCES campaigns(campaign_id)
        )
      `;

      // Execute table creation
      this.db.serialize(() => {
        this.db.run(createCampaignsTable, (err) => {
          if (err) {
            console.error('Error creating campaigns table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(createMessageLogTable, (err) => {
          if (err) {
            console.error('Error creating message_log table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(createScheduledMessagesTable, (err) => {
          if (err) {
            console.error('Error creating scheduled_messages table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(createTemplatesTable, (err) => {
          if (err) {
            console.error('Error creating message_templates table:', err);
            reject(err);
            return;
          }
        });

        this.db.run(createRecipientsTable, (err) => {
          if (err) {
            console.error('Error creating campaign_recipients table:', err);
            reject(err);
            return;
          }

          console.log('Database tables created successfully');
          resolve();
        });
      });
    });
  }

  // Campaign Management Methods
  async createCampaign(campaignData) {
    return new Promise((resolve, reject) => {
      const campaignId = this.generateCampaignId();
      const query = `
        INSERT INTO campaigns (
          campaign_id, campaign_name, message_content, sender_id, response_mode,
          yes_response, no_response, invalid_response, total_recipients,
          scheduled_date, scheduled_time, timezone
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(query, [
        campaignId,
        campaignData.campaign_name,
        campaignData.message_content,
        campaignData.sender_id,
        campaignData.response_mode || 'one-way',
        campaignData.yes_response,
        campaignData.no_response,
        campaignData.invalid_response,
        campaignData.total_recipients || 0,
        campaignData.scheduled_date,
        campaignData.scheduled_time,
        campaignData.timezone
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            campaign_id: campaignId,
            campaign_name: campaignData.campaign_name
          });
        }
      });
    });
  }

  async getAllCampaigns() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM campaigns
        ORDER BY created_at DESC
      `;

      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getCampaignById(campaignId) {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM campaigns WHERE campaign_id = ?`;

      this.db.get(query, [campaignId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async updateCampaignStatus(campaignId, status, sentCount = null) {
    return new Promise((resolve, reject) => {
      let query = `UPDATE campaigns SET status = ?, updated_at = CURRENT_TIMESTAMP`;
      let params = [status];

      if (sentCount !== null) {
        query += `, sent_count = ?`;
        params.push(sentCount);
      }

      query += ` WHERE campaign_id = ?`;
      params.push(campaignId);

      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // Recipients Management
  async addCampaignRecipients(campaignId, recipients) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO campaign_recipients (campaign_id, phone_number, first_name, last_name)
        VALUES (?, ?, ?, ?)
      `;

      this.db.serialize(() => {
        const stmt = this.db.prepare(query);

        recipients.forEach(recipient => {
          stmt.run([campaignId, recipient.phone_number, recipient.first_name, recipient.last_name]);
        });

        stmt.finalize((err) => {
          if (err) {
            reject(err);
          } else {
            resolve({ added: recipients.length });
          }
        });
      });
    });
  }

  async getCampaignRecipients(campaignId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM campaign_recipients
        WHERE campaign_id = ?
        ORDER BY created_at ASC
      `;

      this.db.all(query, [campaignId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async updateRecipientStatus(campaignId, phoneNumber, status) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE campaign_recipients
        SET message_status = ?
        WHERE campaign_id = ? AND phone_number = ?
      `;

      this.db.run(query, [status, campaignId, phoneNumber], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // Message logging
  async logMessage(campaignId, phoneNumber, messageType, content, messageSid = null, status = null, responseKeyword = null) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO message_log (campaign_id, phone_number, message_type, message_content, message_sid, status, response_keyword)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(query, [campaignId, phoneNumber, messageType, content, messageSid, status, responseKeyword], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  // Response handling for YES/NO/INVALID keywords
  async processInboundMessage(phoneNumber, messageContent) {
    return new Promise((resolve, reject) => {
      // Find the most recent campaign for this phone number with recipient info
      const query = `
        SELECT c.*, cr.campaign_id as recipient_campaign_id, cr.first_name, cr.last_name
        FROM campaigns c
        JOIN campaign_recipients cr ON c.campaign_id = cr.campaign_id
        WHERE cr.phone_number = ? AND c.response_mode = 'two-way'
        ORDER BY c.created_at DESC
        LIMIT 1
      `;

      this.db.get(query, [phoneNumber], (err, campaign) => {
        if (err) {
          reject(err);
          return;
        }

        if (!campaign) {
          resolve({ handled: false, message: 'No active two-way campaign found for this number' });
          return;
        }

        // Process keyword response
        const keyword = messageContent.trim().toLowerCase();
        let responseMessage = '';
        let responseKeyword = '';

        if (keyword.startsWith('yes')) {
          responseMessage = campaign.yes_response;
          responseKeyword = 'YES';
        } else if (keyword.startsWith('no')) {
          responseMessage = campaign.no_response;
          responseKeyword = 'NO';
        } else {
          responseMessage = campaign.invalid_response;
          responseKeyword = 'INVALID';
        }

        // Personalize the response message
        if (responseMessage && campaign.first_name) {
          // Support all common first name variations
          responseMessage = responseMessage.replace(/{firstName}/g, campaign.first_name);
          responseMessage = responseMessage.replace(/{FirstName}/g, campaign.first_name);
          responseMessage = responseMessage.replace(/{first_name}/g, campaign.first_name);
          responseMessage = responseMessage.replace(/{First name}/g, campaign.first_name);
          responseMessage = responseMessage.replace(/{First Name}/g, campaign.first_name);
          responseMessage = responseMessage.replace(/{FIRST_NAME}/g, campaign.first_name.toUpperCase());
          responseMessage = responseMessage.replace(/{FIRSTNAME}/g, campaign.first_name.toUpperCase());
        }
        if (responseMessage && campaign.last_name) {
          // Support all common last name variations
          responseMessage = responseMessage.replace(/{lastName}/g, campaign.last_name);
          responseMessage = responseMessage.replace(/{LastName}/g, campaign.last_name);
          responseMessage = responseMessage.replace(/{last_name}/g, campaign.last_name);
          responseMessage = responseMessage.replace(/{Last name}/g, campaign.last_name);
          responseMessage = responseMessage.replace(/{Last Name}/g, campaign.last_name);
          responseMessage = responseMessage.replace(/{LAST_NAME}/g, campaign.last_name.toUpperCase());
          responseMessage = responseMessage.replace(/{LASTNAME}/g, campaign.last_name.toUpperCase());
        }
        // Support for full name
        if (responseMessage && (campaign.first_name || campaign.last_name)) {
          const fullName = `${campaign.first_name || ''} ${campaign.last_name || ''}`.trim();
          if (fullName) {
            responseMessage = responseMessage.replace(/{fullName}/g, fullName);
            responseMessage = responseMessage.replace(/{FullName}/g, fullName);
            responseMessage = responseMessage.replace(/{full_name}/g, fullName);
            responseMessage = responseMessage.replace(/{Full name}/g, fullName);
            responseMessage = responseMessage.replace(/{Full Name}/g, fullName);
            responseMessage = responseMessage.replace(/{FULL_NAME}/g, fullName.toUpperCase());
            responseMessage = responseMessage.replace(/{FULLNAME}/g, fullName.toUpperCase());
          }
        }

        console.log(`Personalized webhook response for ${campaign.first_name}: ${responseMessage}`); // Debug log

        // Log the inbound message
        this.logMessage(campaign.campaign_id, phoneNumber, 'inbound', messageContent, null, null, responseKeyword)
          .then(() => {
            // Update recipient response
            const updateQuery = `
              UPDATE campaign_recipients
              SET response_keyword = ?, response_received_at = CURRENT_TIMESTAMP
              WHERE campaign_id = ? AND phone_number = ?
            `;

            this.db.run(updateQuery, [responseKeyword, campaign.campaign_id, phoneNumber], (updateErr) => {
              if (updateErr) {
                reject(updateErr);
              } else {
                resolve({
                  handled: true,
                  responseMessage,
                  responseKeyword,
                  campaignId: campaign.campaign_id
                });
              }
            });
          })
          .catch(reject);
      });
    });
  }

  // Template methods (reused from existing system)
  async addTemplate(templateData) {
    return new Promise((resolve, reject) => {
      const templateId = 'tmpl_' + Date.now();
      const query = `
        INSERT INTO message_templates (template_id, template_name, category, content, variables, description)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      this.db.run(query, [
        templateId,
        templateData.template_name,
        templateData.category || 'General',
        templateData.content,
        JSON.stringify(templateData.variables || []),
        templateData.description
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, template_id: templateId });
        }
      });
    });
  }

  async getTemplates() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM message_templates
        WHERE is_active = 1
        ORDER BY usage_count DESC, created_at DESC
      `;

      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Parse variables JSON
          const templates = rows.map(row => ({
            ...row,
            variables: JSON.parse(row.variables || '[]')
          }));
          resolve(templates);
        }
      });
    });
  }

  async getTemplateById(templateId) {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM message_templates WHERE template_id = ? AND is_active = 1`;

      this.db.get(query, [templateId], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          resolve({
            ...row,
            variables: JSON.parse(row.variables || '[]')
          });
        } else {
          resolve(null);
        }
      });
    });
  }

  async incrementTemplateUsage(templateId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE message_templates
        SET usage_count = usage_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE template_id = ?
      `;

      this.db.run(query, [templateId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // Scheduled messages (reused from existing system)
  async addScheduledMessage(scheduleData) {
    return new Promise((resolve, reject) => {
      const scheduleId = 'sched_' + Date.now();
      const query = `
        INSERT INTO scheduled_messages (
          schedule_id, campaign_id, message_content, recipients,
          scheduled_date, scheduled_time, timezone
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(query, [
        scheduleId,
        scheduleData.campaign_id,
        scheduleData.message_content,
        JSON.stringify(scheduleData.recipients),
        scheduleData.scheduled_date,
        scheduleData.scheduled_time,
        scheduleData.timezone || 'UTC'
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, schedule_id: scheduleId });
        }
      });
    });
  }

  async getScheduledMessages() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT sm.*, c.campaign_name
        FROM scheduled_messages sm
        LEFT JOIN campaigns c ON sm.campaign_id = c.campaign_id
        WHERE sm.status = 'pending'
        ORDER BY sm.scheduled_date ASC, sm.scheduled_time ASC
      `;

      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const messages = rows.map(row => ({
            ...row,
            recipients: JSON.parse(row.recipients || '[]')
          }));
          resolve(messages);
        }
      });
    });
  }

  async updateScheduledMessageStatus(scheduleId, status) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE scheduled_messages
        SET status = ?, sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END,
            updated_at = CURRENT_TIMESTAMP
        WHERE schedule_id = ?
      `;

      this.db.run(query, [status, status, scheduleId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // Response reporting methods
  async getCampaignResponseReport(campaignId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT
          cr.phone_number,
          cr.first_name,
          cr.last_name,
          cr.response_keyword,
          cr.response_received_at,
          c.campaign_name,
          c.created_at as campaign_created_at
        FROM campaign_recipients cr
        JOIN campaigns c ON cr.campaign_id = c.campaign_id
        WHERE cr.campaign_id = ? AND cr.response_keyword IS NOT NULL
        ORDER BY cr.response_received_at DESC
      `;

      this.db.all(query, [campaignId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getResponsesByType(campaignId, responseType) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT
          cr.phone_number,
          cr.first_name,
          cr.last_name,
          cr.response_keyword,
          cr.response_received_at,
          c.campaign_name
        FROM campaign_recipients cr
        JOIN campaigns c ON cr.campaign_id = c.campaign_id
        WHERE cr.campaign_id = ? AND UPPER(cr.response_keyword) = UPPER(?)
        ORDER BY cr.response_received_at DESC
      `;

      this.db.all(query, [campaignId, responseType], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getAllCampaignResponses(campaignId = null, startDate = null, endDate = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT
          c.campaign_id,
          c.campaign_name,
          cr.phone_number,
          cr.first_name,
          cr.last_name,
          cr.response_keyword,
          cr.response_received_at,
          c.created_at as campaign_created_at
        FROM campaign_recipients cr
        JOIN campaigns c ON cr.campaign_id = c.campaign_id
        WHERE cr.response_keyword IS NOT NULL
      `;

      const params = [];

      if (campaignId) {
        query += ` AND cr.campaign_id = ?`;
        params.push(campaignId);
      }

      if (startDate) {
        query += ` AND DATE(cr.response_received_at) >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND DATE(cr.response_received_at) <= ?`;
        params.push(endDate);
      }

      query += ` ORDER BY cr.response_received_at DESC`;

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async getResponseSummary(campaignId = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT
          c.campaign_id,
          c.campaign_name,
          c.response_mode,
          c.total_recipients,
          COUNT(CASE WHEN UPPER(cr.response_keyword) = 'YES' THEN 1 END) as yes_responses,
          COUNT(CASE WHEN UPPER(cr.response_keyword) = 'NO' THEN 1 END) as no_responses,
          COUNT(CASE WHEN cr.response_keyword IS NOT NULL AND UPPER(cr.response_keyword) NOT IN ('YES', 'NO') THEN 1 END) as other_responses,
          COUNT(CASE WHEN cr.response_keyword IS NOT NULL THEN 1 END) as total_responses,
          COUNT(CASE WHEN cr.response_keyword IS NULL THEN 1 END) as no_response
        FROM campaigns c
        LEFT JOIN campaign_recipients cr ON c.campaign_id = cr.campaign_id
        WHERE c.response_mode = 'two-way'
      `;

      const params = [];

      if (campaignId) {
        query += ` AND c.campaign_id = ?`;
        params.push(campaignId);
      }

      query += ` GROUP BY c.campaign_id, c.campaign_name, c.response_mode, c.total_recipients
                 ORDER BY c.created_at DESC`;

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('Database connection closed.');
        }
      });
    }
  }
}

module.exports = Database;