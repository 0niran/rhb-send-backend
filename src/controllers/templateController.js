const Database = require('../models/database');
const { v4: uuidv4 } = require('uuid');

class TemplateController {
  constructor() {
    this.db = null;
  }

  // Initialize database connection
  async init() {
    this.db = new Database();
    await this.db.init();
    console.log('Template Controller initialized successfully');
  }

  // Create a new template
  async createTemplate(req, res) {
    try {
      const {
        templateName,
        category,
        content,
        variables = [],
        description
      } = req.body;

      // Validate required fields
      if (!templateName || !category || !content) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          details: 'templateName, category, and content are required'
        });
      }

      // Generate unique template ID
      const templateId = uuidv4();

      // Extract variables from content if not provided
      let templateVariables = variables;
      if (!templateVariables.length) {
        const variableMatches = content.match(/\{([^}]+)\}/g);
        if (variableMatches) {
          templateVariables = [...new Set(variableMatches.map(match => match.slice(1, -1)))];
        }
      }

      // Create template record
      const templateData = {
        templateId,
        templateName,
        category,
        content,
        variables: templateVariables,
        description
      };

      const result = await this.db.addTemplate(templateData);

      res.json({
        success: true,
        message: 'Template created successfully',
        data: {
          templateId,
          templateName,
          category,
          variables: templateVariables
        }
      });

    } catch (error) {
      console.error('Error creating template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create template',
        details: error.message
      });
    }
  }

  // Get all templates
  async getTemplates(req, res) {
    try {
      const { category, search } = req.query;

      let templates;

      if (search) {
        templates = await this.db.searchTemplates(search);
      } else {
        templates = await this.db.getTemplates(category);
      }

      res.json({
        success: true,
        data: templates,
        count: templates.length
      });

    } catch (error) {
      console.error('Error getting templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get templates',
        details: error.message
      });
    }
  }

  // Get template by ID
  async getTemplateById(req, res) {
    try {
      const { templateId } = req.params;

      if (!templateId) {
        return res.status(400).json({
          success: false,
          error: 'Missing template ID'
        });
      }

      const template = await this.db.getTemplateById(templateId);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      res.json({
        success: true,
        data: template
      });

    } catch (error) {
      console.error('Error getting template by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get template',
        details: error.message
      });
    }
  }

  // Update template
  async updateTemplate(req, res) {
    try {
      const { templateId } = req.params;
      const {
        templateName,
        category,
        content,
        variables = [],
        description
      } = req.body;

      if (!templateId) {
        return res.status(400).json({
          success: false,
          error: 'Missing template ID'
        });
      }

      // Check if template exists
      const existingTemplate = await this.db.getTemplateById(templateId);
      if (!existingTemplate) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      // Extract variables from content if not provided
      let templateVariables = variables;
      if (content && !templateVariables.length) {
        const variableMatches = content.match(/\{([^}]+)\}/g);
        if (variableMatches) {
          templateVariables = [...new Set(variableMatches.map(match => match.slice(1, -1)))];
        }
      }

      // Update template
      const templateData = {
        templateName: templateName || existingTemplate.template_name,
        category: category || existingTemplate.category,
        content: content || existingTemplate.content,
        variables: templateVariables.length ? templateVariables : existingTemplate.variables,
        description: description !== undefined ? description : existingTemplate.description
      };

      const result = await this.db.updateTemplate(templateId, templateData);

      if (result.changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      res.json({
        success: true,
        message: 'Template updated successfully',
        data: { templateId, ...templateData }
      });

    } catch (error) {
      console.error('Error updating template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update template',
        details: error.message
      });
    }
  }

  // Delete template
  async deleteTemplate(req, res) {
    try {
      const { templateId } = req.params;

      if (!templateId) {
        return res.status(400).json({
          success: false,
          error: 'Missing template ID'
        });
      }

      const result = await this.db.deleteTemplate(templateId);

      if (result.changes === 0) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      res.json({
        success: true,
        message: 'Template deleted successfully',
        data: { templateId }
      });

    } catch (error) {
      console.error('Error deleting template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete template',
        details: error.message
      });
    }
  }

  // Get template categories
  async getCategories(req, res) {
    try {
      const categories = await this.db.getTemplateCategories();

      res.json({
        success: true,
        data: categories
      });

    } catch (error) {
      console.error('Error getting template categories:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get template categories',
        details: error.message
      });
    }
  }

  // Use template (increment usage count and return processed content)
  async useTemplate(req, res) {
    try {
      const { templateId } = req.params;
      const { variables = {} } = req.body;

      if (!templateId) {
        return res.status(400).json({
          success: false,
          error: 'Missing template ID'
        });
      }

      // Get template
      const template = await this.db.getTemplateById(templateId);
      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found'
        });
      }

      // Process template content with variables
      let processedContent = template.content;

      // Replace variables in the format {variableName}
      Object.keys(variables).forEach(key => {
        const placeholder = `{${key}}`;
        processedContent = processedContent.replace(new RegExp(placeholder, 'g'), variables[key]);
      });

      // Increment usage count
      await this.db.incrementTemplateUsage(templateId);

      res.json({
        success: true,
        data: {
          templateId,
          templateName: template.template_name,
          originalContent: template.content,
          processedContent,
          variables: template.variables,
          providedVariables: variables
        }
      });

    } catch (error) {
      console.error('Error using template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process template',
        details: error.message
      });
    }
  }

  // Preview template with sample variables
  async previewTemplate(req, res) {
    try {
      const { content, variables = {} } = req.body;

      if (!content) {
        return res.status(400).json({
          success: false,
          error: 'Missing template content'
        });
      }

      // Process template content with variables
      let processedContent = content;

      // Replace variables in the format {variableName}
      Object.keys(variables).forEach(key => {
        const placeholder = `{${key}}`;
        processedContent = processedContent.replace(new RegExp(placeholder, 'g'), variables[key]);
      });

      // Extract all variables from content
      const variableMatches = content.match(/\{([^}]+)\}/g);
      const availableVariables = variableMatches ?
        [...new Set(variableMatches.map(match => match.slice(1, -1)))] : [];

      res.json({
        success: true,
        data: {
          originalContent: content,
          processedContent,
          availableVariables,
          providedVariables: variables
        }
      });

    } catch (error) {
      console.error('Error previewing template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to preview template',
        details: error.message
      });
    }
  }
}

module.exports = TemplateController;