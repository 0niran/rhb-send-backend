require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');

// Controllers
const CampaignController = require('./src/controllers/campaignController');
const TemplateController = require('./src/controllers/templateController');

// Routes
const { router: campaignRoutes, initializeCampaignController } = require('./src/routes/campaignRoutes');
const { router: templateRoutes, initializeTemplateController } = require('./src/routes/templateRoutes');

class RHBSendServer {
  constructor() {
    this.app = express();
    this.port = process.env.PORT || 3001;
    this.controllers = {};
  }

  async initialize() {
    console.log('==================================================');
    console.log('🚀 RHB Send - Internal SMS Tool');
    console.log('==================================================');

    // Initialize Express middleware
    this.setupMiddleware();

    // Initialize controllers
    await this.initializeControllers();

    // Setup routes
    this.setupRoutes();

    // Setup error handling
    this.setupErrorHandling();

    // Start server
    this.startServer();
  }

  setupMiddleware() {
    // CORS middleware
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    });

    // Body parser middleware
    this.app.use(bodyParser.json({ limit: '10mb' }));
    this.app.use(bodyParser.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  async initializeControllers() {
    try {
      console.log('📊 Initializing controllers...');

      // Initialize Campaign Controller
      this.controllers.campaign = new CampaignController();
      initializeCampaignController(this.controllers.campaign);
      console.log('✅ Campaign Controller initialized');

      // Initialize Template Controller
      this.controllers.template = new TemplateController();
      initializeTemplateController(this.controllers.template);
      console.log('✅ Template Controller initialized');

    } catch (error) {
      console.error('❌ Controller initialization failed:', error);
      throw error;
    }
  }

  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        success: true,
        message: 'RHB Send API is running',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      });
    });

    // Root endpoint with API documentation
    this.app.get('/', (req, res) => {
      res.json({
        name: 'RHB Send - Internal SMS Tool',
        version: '1.0.0',
        description: 'Simple bulk SMS campaigns with response handling',
        endpoints: {
          health: 'GET /health',
          campaigns: {
            create: 'POST /api/campaigns/create',
            list: 'GET /api/campaigns/list',
            details: 'GET /api/campaigns/details/:campaignId',
            stats: 'GET /api/campaigns/stats',
            scheduled: 'GET /api/campaigns/scheduled',
            cancelScheduled: 'PUT /api/campaigns/scheduled/:scheduleId/cancel',
            webhook: 'POST /api/campaigns/webhook/inbound'
          },
          templates: {
            create: 'POST /api/templates/create',
            list: 'GET /api/templates/list',
            get: 'GET /api/templates/:templateId',
            use: 'POST /api/templates/use/:templateId',
            delete: 'DELETE /api/templates/:templateId'
          }
        },
        features: [
          'Bulk SMS campaigns with CSV upload',
          'One-way and two-way messaging',
          'YES/NO/INVALID response handling',
          'Message scheduling',
          'Template management',
          '8-digit campaign ID tracking'
        ]
      });
    });

    // API routes
    this.app.use('/api/campaigns', campaignRoutes);
    this.app.use('/api/templates', templateRoutes);

    console.log('🛣️  Routes initialized');
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      console.error('Global error handler:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    });
  }

  startServer() {
    this.app.listen(this.port, () => {
      console.log('==================================================');
      console.log(`📱 RHB Send API running on port ${this.port}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📍 Local URL: http://localhost:${this.port}`);
      console.log(`🔗 API Documentation: http://localhost:${this.port}/`);
      console.log('==================================================');

      // Log configuration status
      const twilioConfigured = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN;
      console.log(twilioConfigured ? '✅ Twilio credentials configured' : '⚠️  Twilio credentials not configured');
      console.log(`📋 ${process.env.NODE_ENV === 'development' ? 'Development' : 'Production'} mode - ${twilioConfigured ? 'ready for SMS' : 'demo mode'}`);
      console.log('==================================================');
    });
  }
}

// Start the server
async function startRHBSend() {
  try {
    const server = new RHBSendServer();
    await server.initialize();
  } catch (error) {
    console.error('Failed to start RHB Send server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down RHB Send server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down RHB Send server...');
  process.exit(0);
});

// Start the application
startRHBSend();