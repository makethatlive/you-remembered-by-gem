// API client for local development
// This replaces the Base44 SDK with calls to our Express API backend

const API_BASE = import.meta.env.PROD 
  ? '/api'  // Production: same domain
  : 'http://localhost:3001/api';  // Development: separate server

// Helper to convert snake_case to camelCase for responses
function toCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(toCamelCase);
  }
  if (obj && typeof obj === 'object') {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      newObj[camelKey] = toCamelCase(value);
    }
    return newObj;
  }
  return obj;
}

// Helper to convert camelCase to snake_case for requests
function toSnakeCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(toSnakeCase);
  }
  if (obj && typeof obj === 'object' && obj.constructor === Object) {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      newObj[snakeKey] = toSnakeCase(value);
    }
    return newObj;
  }
  return obj;
}

// API client that mimics the Base44 SDK API
export const base44 = {
  auth: {
    me: async () => {
      // Get current user from localStorage (set by AuthContext)
      const storedUser = localStorage.getItem('auth_user');
      if (storedUser) {
        return JSON.parse(storedUser);
      }
      return null;
    },
    logout: (redirectUrl) => {
      localStorage.removeItem('auth_user');
      if (redirectUrl) {
        window.location.href = redirectUrl;
      }
    },
    redirectToLogin: (returnUrl) => {
      window.location.href = '/login';
    },
  },
  
  entities: {
    Recipient: {
      filter: async (filters) => {
        console.log('🔍 Recipient.filter called with:', filters);
        const params = new URLSearchParams(toSnakeCase(filters));
        const url = `${API_BASE}/recipients?${params}`;
        console.log('📡 Fetching:', url);
        const response = await fetch(url);
        console.log('📥 Response status:', response.status, response.statusText);
        if (!response.ok) {
          console.error('❌ Failed to fetch recipients:', response.status, response.statusText);
          const errorText = await response.text();
          console.error('❌ Error response:', errorText);
          throw new Error('Failed to fetch recipients');
        }
        const rawData = await response.json();
        console.log('📦 Raw data received:', rawData);
        const data = toCamelCase(rawData);
        console.log('✅ Recipients after camelCase conversion:', data);
        return data;
      },
      list: async (sortBy, limit) => {
        console.log('📋 Recipient.list called');
        const params = new URLSearchParams();
        if (limit) params.set('limit', limit);
        const url = `${API_BASE}/recipients?${params}`;
        console.log('📡 Fetching:', url);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to list recipients');
        const data = toCamelCase(await response.json());
        console.log('✅ Recipients listed:', data.length, 'items');
        return data;
      },
      get: async (id) => {
        const response = await fetch(`${API_BASE}/recipients/${id}`);
        if (!response.ok) return null;
        return toCamelCase(await response.json());
      },
      create: async (data) => {
        const response = await fetch(`${API_BASE}/recipients`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSnakeCase(data)),
        });
        if (!response.ok) throw new Error('Failed to create recipient');
        return toCamelCase(await response.json());
      },
      update: async (id, data) => {
        const response = await fetch(`${API_BASE}/recipients/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSnakeCase(data)),
        });
        if (!response.ok) throw new Error('Failed to update recipient');
        return toCamelCase(await response.json());
      },
      delete: async (id) => {
        const response = await fetch(`${API_BASE}/recipients/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete recipient');
        return await response.json();
      },
    },
    
    GiftList: {
      filter: async (filters) => {
        const params = new URLSearchParams(toSnakeCase(filters));
        const response = await fetch(`${API_BASE}/gift-lists?${params}`);
        if (!response.ok) throw new Error('Failed to fetch gift lists');
        return toCamelCase(await response.json());
      },
      list: async (sortBy, limit) => {
        console.log('📋 GiftList.list called');
        const params = new URLSearchParams();
        if (limit) params.set('limit', limit);
        const response = await fetch(`${API_BASE}/gift-lists?${params}`);
        if (!response.ok) throw new Error('Failed to list gift lists');
        const data = toCamelCase(await response.json());
        console.log('✅ Gift lists listed:', data.length, 'items');
        return data;
      },
      get: async (id) => {
        const response = await fetch(`${API_BASE}/gift-lists/${id}`);
        if (!response.ok) return null;
        return toCamelCase(await response.json());
      },
      create: async (data) => {
        console.warn('Mock: GiftList.create not yet implemented', data);
        return data;
      },
      update: async (id, data) => {
        console.log('📋 GiftList.update called for:', id);
        const response = await fetch(`${API_BASE}/gift-lists/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSnakeCase(data)),
        });
        if (!response.ok) throw new Error('Failed to update gift list');
        const updated = toCamelCase(await response.json());
        console.log('✅ Gift list updated:', id);
        return updated;
      },
    },
    
    GiftItem: {
      filter: async (filters) => {
        console.log('📋 GiftItem.filter called');
        const params = new URLSearchParams(toSnakeCase(filters));
        const response = await fetch(`${API_BASE}/gift-items?${params}`);
        if (!response.ok) throw new Error('Failed to filter gift items');
        const data = toCamelCase(await response.json());
        console.log('✅ Gift items filtered:', data.length, 'items');
        return data;
      },
      list: async (sortBy, limit) => {
        console.log('📋 GiftItem.list called');
        const params = new URLSearchParams();
        if (limit) params.set('limit', Math.min(limit, 1000));
        const response = await fetch(`${API_BASE}/gift-items?${params}`);
        if (!response.ok) throw new Error('Failed to list gift items');
        const data = toCamelCase(await response.json());
        console.log('✅ Gift items listed:', data.length, 'items');
        return data;
      },
      get: async (id) => {
        console.log('📋 GiftItem.get called for:', id);
        const response = await fetch(`${API_BASE}/gift-items/${id}`);
        if (!response.ok) return null;
        return toCamelCase(await response.json());
      },
      create: async (data) => {
        console.log('📋 GiftItem.create called with:', data);
        const response = await fetch(`${API_BASE}/gift-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSnakeCase(data)),
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Failed to create gift item:', response.status, errorText);
          throw new Error('Failed to create gift item');
        }
        const created = toCamelCase(await response.json());
        console.log('✅ Gift item created:', created.id);
        return created;
      },
      update: async (id, data) => {
        console.log('📋 GiftItem.update called for:', id);
        const response = await fetch(`${API_BASE}/gift-items/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSnakeCase(data)),
        });
        if (!response.ok) throw new Error('Failed to update gift item');
        const updated = toCamelCase(await response.json());
        console.log('✅ Gift item updated:', id);
        return updated;
      },
    },
    
    EmailLog: {
      filter: async (filters) => {
        console.log('📋 EmailLog.filter called with:', filters);
        const params = new URLSearchParams(toSnakeCase(filters));
        const response = await fetch(`${API_BASE}/email-logs?${params}`);
        if (!response.ok) throw new Error('Failed to filter email logs');
        const data = toCamelCase(await response.json());
        console.log('✅ Email logs filtered:', data.length, 'items');
        return data;
      },
      list: async (sortBy, limit) => {
        console.log('📋 EmailLog.list called');
        const params = new URLSearchParams();
        if (limit) params.set('limit', Math.min(limit, 1000));
        const response = await fetch(`${API_BASE}/email-logs?${params}`);
        if (!response.ok) throw new Error('Failed to list email logs');
        const data = toCamelCase(await response.json());
        console.log('✅ Email logs listed:', data.length, 'items');
        return data;
      },
      get: async (id) => {
        console.log('📋 EmailLog.get called for:', id);
        const response = await fetch(`${API_BASE}/email-logs/${id}`);
        if (!response.ok) return null;
        return toCamelCase(await response.json());
      },
      create: async (data) => {
        console.log('📋 EmailLog.create called');
        const response = await fetch(`${API_BASE}/email-logs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSnakeCase(data)),
        });
        if (!response.ok) throw new Error('Failed to create email log');
        const created = toCamelCase(await response.json());
        console.log('✅ Email log created:', created.id);
        return created;
      },
    },
    
    Product: {
      filter: async (filters, sortBy, limit) => {
        console.log('📋 Product.filter called with:', filters);
        const params = new URLSearchParams(toSnakeCase(filters));
        if (limit) params.set('limit', Math.min(limit, 5000));
        const response = await fetch(`${API_BASE}/products?${params}`);
        if (!response.ok) throw new Error('Failed to fetch products');
        const data = toCamelCase(await response.json());
        console.log('✅ Products filtered:', data.length, 'items');
        return data;
      },
      list: async (sortBy, limit) => {
        console.log('📋 Product.list called');
        const params = new URLSearchParams();
        if (limit) params.set('limit', Math.min(limit, 10000)); // Cap at 10000 to handle large catalogs
        const response = await fetch(`${API_BASE}/products?${params}`);
        if (!response.ok) throw new Error('Failed to list products');
        const data = toCamelCase(await response.json());
        console.log('✅ Products listed:', data.length, 'items');
        return data;
      },
      get: async (id) => {
        const response = await fetch(`${API_BASE}/products/${id}`);
        if (!response.ok) return null;
        return toCamelCase(await response.json());
      },
      create: async (data) => {
        console.log('📋 Product.create called');
        const response = await fetch(`${API_BASE}/products`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSnakeCase(data)),
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Failed to create product:', response.status, errorText);
          throw new Error('Failed to create product');
        }
        const created = toCamelCase(await response.json());
        console.log('✅ Product created:', created.id);
        return created;
      },
      update: async (id, data) => {
        console.log('📋 Product.update called for:', id, 'with data:', data);
        const response = await fetch(`${API_BASE}/products/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSnakeCase(data)),
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Failed to update product:', response.status, errorText);
          throw new Error('Failed to update product');
        }
        const updated = toCamelCase(await response.json());
        console.log('✅ Product updated:', id);
        return updated;
      },
    },
    
    Retailer: {
      filter: async (filters) => {
        const params = new URLSearchParams(toSnakeCase(filters));
        const response = await fetch(`${API_BASE}/retailers?${params}`);
        if (!response.ok) throw new Error('Failed to fetch retailers');
        return toCamelCase(await response.json());
      },
      list: async (sortBy, limit) => {
        console.log('📋 Retailer.list called');
        const params = new URLSearchParams();
        if (limit) params.set('limit', limit);
        const response = await fetch(`${API_BASE}/retailers?${params}`);
        if (!response.ok) throw new Error('Failed to list retailers');
        const data = toCamelCase(await response.json());
        console.log('✅ Retailers listed:', data.length, 'items');
        return data;
      },
      get: async (id) => {
        const response = await fetch(`${API_BASE}/retailers/${id}`);
        if (!response.ok) return null;
        return toCamelCase(await response.json());
      },
      create: async (data) => {
        console.log('📋 Retailer.create called');
        const response = await fetch(`${API_BASE}/retailers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSnakeCase(data)),
        });
        if (!response.ok) throw new Error('Failed to create retailer');
        const created = toCamelCase(await response.json());
        console.log('✅ Retailer created:', created.id);
        return created;
      },
      update: async (id, data) => {
        console.log('📋 Retailer.update called for:', id);
        const response = await fetch(`${API_BASE}/retailers/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSnakeCase(data)),
        });
        if (!response.ok) throw new Error('Failed to update retailer');
        const updated = toCamelCase(await response.json());
        console.log('✅ Retailer updated:', id);
        return updated;
      },
    },
    
    Subscriber: {
      filter: async (filters) => {
        console.log('🔍 Subscriber.filter called with:', filters);
        const params = new URLSearchParams(toSnakeCase(filters));
        const url = `${API_BASE}/subscribers?${params}`;
        console.log('📡 Fetching:', url);
        const response = await fetch(url);
        if (!response.ok) {
          console.error('❌ Failed to fetch subscribers:', response.status, response.statusText);
          throw new Error('Failed to fetch subscribers');
        }
        const data = toCamelCase(await response.json());
        console.log('✅ Subscribers received:', data);
        return data;
      },
      list: async (sortBy, limit) => {
        console.log('📋 Subscriber.list called');
        const params = new URLSearchParams();
        if (limit) params.set('limit', limit);
        const response = await fetch(`${API_BASE}/subscribers?${params}`);
        if (!response.ok) throw new Error('Failed to list subscribers');
        const data = toCamelCase(await response.json());
        console.log('✅ Subscribers listed:', data.length, 'items');
        return data;
      },
      get: async (id) => {
        const response = await fetch(`${API_BASE}/subscribers/${id}`);
        if (!response.ok) return null;
        return toCamelCase(await response.json());
      },
      create: async (data) => {
        const response = await fetch(`${API_BASE}/subscribers`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSnakeCase(data)),
        });
        if (!response.ok) throw new Error('Failed to create subscriber');
        return toCamelCase(await response.json());
      },
      update: async (id, data) => {
        const response = await fetch(`${API_BASE}/subscribers/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSnakeCase(data)),
        });
        if (!response.ok) throw new Error('Failed to update subscriber');
        return toCamelCase(await response.json());
      },
    },
    
    User: {
      filter: async (filters) => {
        const params = new URLSearchParams(toSnakeCase(filters));
        const response = await fetch(`${API_BASE}/users?${params}`);
        if (!response.ok) throw new Error('Failed to fetch users');
        return toCamelCase(await response.json());
      },
      list: async (sortBy, limit) => {
        console.log('📋 User.list called');
        const params = new URLSearchParams();
        if (limit) params.set('limit', limit);
        const response = await fetch(`${API_BASE}/users?${params}`);
        if (!response.ok) throw new Error('Failed to list users');
        const data = toCamelCase(await response.json());
        console.log('✅ Users listed:', data.length, 'items');
        return data;
      },
      get: async (id) => {
        const response = await fetch(`${API_BASE}/users/${id}`);
        if (!response.ok) return null;
        return toCamelCase(await response.json());
      },
      update: async (id, data) => {
        const response = await fetch(`${API_BASE}/users/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toSnakeCase(data)),
        });
        if (!response.ok) throw new Error('Failed to update user');
        return toCamelCase(await response.json());
      },
    },
    
    ScrapeState: {
      list: async () => {
        console.log('📋 ScrapeState.list called');
        const response = await fetch(`${API_BASE}/scrape-state`);
        if (!response.ok) throw new Error('Failed to list scrape state');
        const data = toCamelCase(await response.json());
        console.log('✅ Scrape state listed');
        return data;
      },
      get: async (id) => {
        const response = await fetch(`${API_BASE}/scrape-state/${id}`);
        if (!response.ok) return null;
        return toCamelCase(await response.json());
      },
    },
  },
  
  users: {
    inviteUser: async (email, role = 'user') => {
      console.log('📧 users.inviteUser called for:', email, 'role:', role);
      const response = await fetch(`${API_BASE}/users/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to invite user');
      }
      const data = await response.json();
      console.log('✅ User invitation sent:', email);
      return data;
    },
  },
  
  integrations: {
    // Mock integrations
  },
  
  functions: {
    // Gift generation function - now uses our Gemini AI backend
    invoke: async (functionName, data) => {
      console.log(`🔧 Function ${functionName} called with:`, data);
      
      if (functionName === 'generateGiftList') {
        // Call our new Gemini-powered generation endpoint
        const response = await fetch(`${API_BASE}/generate-gift-list`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to generate gift list');
        }
        
        return await response.json();
      }
      
      // Availability checking function (for "Re-run Scrape" button)
      if (functionName === 'checkAvailabilityBatch') {
        const response = await fetch(`${API_BASE}/products/check-availability-batch`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Admin-Key': localStorage.getItem('admin_key') || '',
          },
          body: JSON.stringify(toSnakeCase(data)),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          const error = new Error(errorData.error || 'Availability check failed');
          error.response = { status: response.status, data: errorData };
          throw error;
        }
        
        const result = await response.json();
        return { data: toCamelCase(result) };
      }
      
      // Scraping functions - now use Express backend
      if (functionName === 'scrapeCatalogueBatch') {
        const response = await fetch(`${API_BASE}/scrape/catalogue-batch`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Admin-Key': localStorage.getItem('admin_key') || '',
          },
          body: JSON.stringify(toSnakeCase(data)),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          const error = new Error(errorData.error || 'Scrape failed');
          error.response = { status: response.status, data: errorData };
          throw error;
        }
        
        const result = await response.json();
        return { data: toCamelCase(result) };
      }
      
      if (functionName === 'monthlyScrape') {
        const response = await fetch(`${API_BASE}/scrape/monthly`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Admin-Key': localStorage.getItem('admin_key') || '',
          },
          body: JSON.stringify(toSnakeCase(data)),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          throw new Error(errorData.error || 'Monthly scrape failed');
        }
        
        return await response.json();
      }
      
      // Enrichment function
      if (functionName === 'enrichCatalogueBatch') {
        const response = await fetch(`${API_BASE}/products/enrich-batch`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Admin-Key': localStorage.getItem('admin_key') || '',
          },
          body: JSON.stringify(toSnakeCase(data)),
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          const error = new Error(errorData.error || 'Enrichment failed');
          error.response = { status: response.status, data: errorData };
          throw error;
        }
        
        const result = await response.json();
        return { data: toCamelCase(result) };
      }

      // Mock other functions
      console.warn(`Mock: Function ${functionName} not yet implemented`, data);
      
      // Mock completePaidSignup - just return success
      if (functionName === 'completePaidSignup') {
        return { success: true, message: 'Mock paid signup completion' };
      }
      
      return { success: true, message: 'Mock function call' };
    },
  },
};

// Export for compatibility
export default base44;

