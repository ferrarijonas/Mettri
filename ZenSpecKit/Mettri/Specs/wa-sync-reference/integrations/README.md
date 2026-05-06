# WA-Sync Modular Integration System

## Overview

The WA-Sync extension now has a modular integration system that makes it easy to add new integrations (HubSpot, Salesforce, Google Sheets, etc.) without modifying core code.

## Architecture

### Key Components

1. **Base Classes** (`/integrations/base/`)
   - `Integration.js` - Abstract base class for all integrations
   - `IntegrationConfig.js` - Base configuration with common properties

2. **Integration Manager** (`/services/integration-manager.js`)
   - Manages all integrations
   - **Only ONE integration can be active at a time**
   - Routes events to the active integration

3. **Integration Registry** (`/integrations/IntegrationRegistry.js`)
   - Central registry of all available integrations
   - Factory for creating integration instances

4. **Built-in Integrations**
   - `Custom Webhook` - Send events to any webhook
   - `HubSpot CRM` - Sync contacts and messages to HubSpot

## Common Configuration (All Integrations)

Every integration config inherits these properties from `IntegrationConfig`:

```javascript
{
  // Webhook/API Configuration
  webhookUrl: '',              // Main API/webhook URL
  webhookMethod: 'POST',       // HTTP method
  headers: {},                 // Custom HTTP headers
  queryParams: {},             // URL query parameters
  customPayloadTemplate: '',   // JavaScript template for payload transformation
  instanceId: '',              // Instance identifier
  
  // Retry Configuration
  retryAttempts: 3,            // Number of retry attempts
  retryDelay: 1000,            // Delay between retries (ms)
  
  // Batch Sync Configuration
  syncEndpoint: '/batch',      // Endpoint for batch sync
  messagesPerBatch: 50,        // Messages per batch
  
  // Event Filters
  eventFilters: {
    message: true,
    message_ack: false,
    message_edit: false,
    // ... etc
  },
  
  // Message Filters
  messageFilters: {
    includeGroups: true,
    includePrivate: true,
    includeFromMe: true,
    includeMedia: true
  }
}
```

## Adding a New Integration

### Step 1: Create Config Class

Create `/integrations/your-service/YourServiceConfig.js`:

```javascript
class YourServiceConfig extends IntegrationConfig {
  constructor(data = {}) {
    super(data); // Inherits all common properties
    
    // Add service-specific properties
    this.apiKey = data.apiKey || '';
    this.accountId = data.accountId || '';
    this.customSetting = data.customSetting || false;
  }

  static getType() {
    return 'your_service';
  }

  validate() {
    const errors = [];
    
    if (!this.apiKey) {
      errors.push('API Key is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  toJSON() {
    return {
      ...super.toJSON(),
      apiKey: this.apiKey,
      accountId: this.accountId,
      customSetting: this.customSetting
    };
  }

  static fromJSON(json) {
    return new YourServiceConfig(json);
  }
}
```

### Step 2: Create Integration Class

Create `/integrations/your-service/YourServiceIntegration.js`:

```javascript
class YourServiceIntegration extends Integration {
  constructor(config) {
    super(config);
  }

  static getMetadata() {
    return {
      type: 'your_service',
      name: 'Your Service Name',
      description: 'Brief description',
      icon: '📊', // Emoji or SVG
      category: 'crm', // webhook, crm, sheets, etc.
      documentationUrl: 'https://docs.wa-sync.com/integrations/your-service'
    };
  }

  static getSettingsFields() {
    return [
      {
        name: 'apiKey',
        type: 'password',
        label: 'API Key',
        placeholder: 'sk-...',
        required: true,
        help: 'Your API key from service dashboard'
      },
      {
        name: 'accountId',
        type: 'text',
        label: 'Account ID',
        placeholder: '12345'
      }
    ];
  }

  // Process a single event (required)
  async processEvent(event, data, metadata) {
    try {
      // 1. Transform data for your service
      const payload = this.buildPayload(event, data, metadata);
      
      // 2. Send to your service API
      const result = await this.sendToService(payload);
      
      // 3. Optionally send to webhook if configured
      if (this.config.webhookUrl) {
        await this.sendToWebhook(payload);
      }
      
      return {
        success: true,
        response: result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Batch sync messages (required)
  async syncMessages(messages, options = {}) {
    let synced = 0;
    let failed = 0;

    // Process messages in batches
    const batchSize = this.config.messagesPerBatch;
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);
      
      try {
        // Send batch to your service
        await this.sendBatchToService(batch);
        synced += batch.length;
      } catch (error) {
        failed += batch.length;
      }
    }

    return { success: failed === 0, synced, failed };
  }

  // Test connection (required)
  async test() {
    try {
      const response = await fetch(`https://api.yourservice.com/test`, {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
      });

      if (response.ok) {
        return { success: true, message: 'Connected successfully' };
      } else {
        return { success: false, error: 'Connection failed' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Helper methods
  async sendToService(payload) {
    const response = await fetch(`https://api.yourservice.com/events`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    return await response.json();
  }

  buildPayload(event, data, metadata) {
    return {
      event,
      timestamp: Date.now(),
      instanceId: this.config.instanceId,
      data,
      metadata
    };
  }

  static fromJSON(json) {
    const config = YourServiceConfig.fromJSON(json.config);
    return new YourServiceIntegration(config);
  }
}
```

### Step 3: Register Integration

In `/integrations/IntegrationRegistry.js`, add:

```javascript
registry.register(
  'your_service',
  self.YourServiceIntegration,
  self.YourServiceConfig
);
```

### Step 4: Load in Service Worker

In `/background/service-worker.js`, add to importScripts:

```javascript
importScripts(
  // ... existing imports
  '/integrations/your-service/YourServiceConfig.js',
  '/integrations/your-service/YourServiceIntegration.js'
);
```

## Using the Integration Manager

```javascript
// Initialize
const registry = createIntegrationRegistry();
const integrationManager = new IntegrationManager();
integrationManager.registry = registry;
await integrationManager.initialize();

// Create and add a new integration
const customConfig = {
  type: 'custom_webhook',
  webhookUrl: 'https://example.com/webhook',
  enabled: true
};
const integration = registry.create('custom_webhook', customConfig);
integrationManager.addIntegration(integration);

// Set as active (only ONE can be active)
await integrationManager.setActiveIntegration(integration.id);

// Process an event (goes to active integration only)
const result = await integrationManager.processEvent('message', messageData, metadata);

// Batch sync
const syncResult = await integrationManager.syncMessages(messages);

// Test integration
const testResult = await integrationManager.testActiveIntegration();

// Switch to different integration
const hubspotIntegration = registry.create('hubspot', {
  accessToken: 'pat-na1-...',
  enabled: true
});
integrationManager.addIntegration(hubspotIntegration);
await integrationManager.setActiveIntegration(hubspotIntegration.id);
```

## Integration Flow

1. **Event Occurs** (new WhatsApp message)
   ↓
2. **Service Worker** receives event
   ↓
3. **Integration Manager** routes to active integration
   ↓
4. **Active Integration** processes event:
   - Calls service API (HubSpot, Salesforce, etc.)
   - Optionally sends to webhook
   - Uses common retry/batch logic from config
   ↓
5. **Result** returned and logged

## Benefits

- ✅ **Single Active Integration** - Only one integration processes events at a time
- ✅ **Easy to Add** - Just extend base classes and register
- ✅ **Common Configuration** - Webhook, retry, batch sync in every integration
- ✅ **Flexible** - Each integration can have its own API logic
- ✅ **Testable** - Built-in test methods
- ✅ **Settings UI** - Auto-generated from `getSettingsFields()`

## Example: Using HubSpot Integration

```javascript
// Create HubSpot integration
const hubspotConfig = {
  type: 'hubspot',
  accessToken: 'pat-na1-xxxxx',
  webhookUrl: 'https://my-server.com/log', // Optional
  createContacts: true,
  logEngagements: true,
  enabled: true
};

const hubspot = registry.create('hubspot', hubspotConfig);
integrationManager.addIntegration(hubspot);
await integrationManager.setActiveIntegration(hubspot.id);

// Now all WhatsApp messages will:
// 1. Create/update contacts in HubSpot
// 2. Log engagements
// 3. Optionally send to webhook
```

## Next Steps

1. Update service-worker.js to use IntegrationManager
2. Update popup UI to show available integrations
3. Add integration switcher in settings
4. Implement Google Sheets integration
5. Implement Salesforce integration
