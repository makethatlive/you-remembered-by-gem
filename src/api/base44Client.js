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
      // Return mock user matching database
      return {
        id: '6a82fcc8dd23ed146cdc7a8f',
        email: 'pph2shoaib@gmail.com',
        role: 'admin',
        full_name: 'pph2shoaib'
      };
    },
    logout: (redirectUrl) => {
      if (redirectUrl) {
        window.location.href = '/';
      }
    },
    redirectToLogin: (returnUrl) => {
      window.location.href = '/';
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
        if (!response.ok) {
          console.error('❌ Failed to fetch recipients:', response.status, response.statusText);
          throw new Error('Failed to fetch recipients');
        }
        const data = toCamelCase(await response.json());
        console.log('✅ Recipients received:', data);
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
        console.warn('Mock: GiftList.update not yet implemented', id, data);
        return { id, ...data };
      },
    },
    
    GiftItem: {
      filter: async (filters) => {
        console.warn('Mock: GiftItem.filter not yet implemented', filters);
        return [];
      },
      list: async (sortBy, limit) => {
        console.log('📋 GiftItem.list called');
        console.warn('Mock: GiftItem.list not yet implemented');
        return [];
      },
      get: async (id) => {
        console.warn('Mock: GiftItem.get not yet implemented', id);
        return null;
      },
    },
    
    EmailLog: {
      filter: async (filters) => {
        console.warn('Mock: EmailLog.filter not yet implemented', filters);
        return [];
      },
      list: async (sortBy, limit) => {
        console.log('📋 EmailLog.list called');
        console.warn('Mock: EmailLog.list not yet implemented');
        return [];
      },
    },
    
    Product: {
      filter: async (filters) => {
        const params = new URLSearchParams(toSnakeCase(filters));
        const response = await fetch(`${API_BASE}/products?${params}`);
        if (!response.ok) throw new Error('Failed to fetch products');
        return toCamelCase(await response.json());
      },
      list: async (sortBy, limit) => {
        console.log('📋 Product.list called');
        const params = new URLSearchParams();
        if (limit) params.set('limit', Math.min(limit, 1000)); // Cap at 1000
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
  },
  
  integrations: {
    // Mock integrations
  },
  
  functions: {
    // Mock function calls
    invoke: async (functionName, data) => {
      console.warn(`Mock: Function ${functionName} called`, data);
      
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

