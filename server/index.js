/**
 * Simple Express API server for local development
 * Provides REST endpoints to access PostgreSQL data via Prisma
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from dist folder in production
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API server running' });
});

// ==================== SUBSCRIBERS ====================

// Get all subscribers
app.get('/api/subscribers', async (req, res) => {
  try {
    const { created_by_id, email } = req.query;
    
    const where = {};
    if (created_by_id) where.createdById = created_by_id;
    if (email) where.email = email;
    
    const subscribers = await prisma.subscriber.findMany({
      where,
      include: {
        createdBy: true,
      }
    });
    
    res.json(subscribers);
  } catch (error) {
    console.error('Error fetching subscribers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single subscriber
app.get('/api/subscribers/:id', async (req, res) => {
  try {
    const subscriber = await prisma.subscriber.findUnique({
      where: { id: req.params.id },
      include: {
        createdBy: true,
        recipients: true,
      }
    });
    
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found' });
    }
    
    res.json(subscriber);
  } catch (error) {
    console.error('Error fetching subscriber:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create subscriber
app.post('/api/subscribers', async (req, res) => {
  try {
    const data = req.body;
    
    // Normalize subscription status to uppercase enum value
    let subscriptionStatus = data.subscriptionStatus || data.subscription_status || 'TRIALLING';
    if (typeof subscriptionStatus === 'string') {
      subscriptionStatus = subscriptionStatus.toUpperCase();
    }
    
    // Ensure user exists for the subscriber
    let userId = data.created_by_id || data.createdById;
    
    if (!userId) {
      // Find or create user by email
      let user = await prisma.user.findUnique({
        where: { email: data.email }
      });
      
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: data.email,
            role: 'USER',
          }
        });
      }
      userId = user.id;
    }
    
    // Check if subscriber already exists for this user
    const existingByUserId = await prisma.subscriber.findFirst({
      where: { createdById: userId }
    });
    
    if (existingByUserId) {
      // Return existing subscriber instead of creating duplicate
      return res.json(existingByUserId);
    }
    
    // Check if subscriber exists by email
    const existingByEmail = await prisma.subscriber.findUnique({
      where: { email: data.email }
    });
    
    if (existingByEmail) {
      // Return existing subscriber instead of creating duplicate
      return res.json(existingByEmail);
    }
    
    const subscriber = await prisma.subscriber.create({
      data: {
        name: data.name,
        firstName: data.firstName || data.first_name,
        email: data.email,
        howHeard: data.howHeard || data.how_heard,
        stripeCustomerId: data.stripeCustomerId || data.stripe_customer_id,
        stripeSubscriptionId: data.stripeSubscriptionId || data.stripe_subscription_id,
        subscriptionStatus: subscriptionStatus,
        subscribedSince: data.subscribedSince || data.subscribed_since,
        createdById: userId,
      }
    });
    
    res.status(201).json(subscriber);
  } catch (error) {
    console.error('Error creating subscriber:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update subscriber
app.patch('/api/subscribers/:id', async (req, res) => {
  try {
    const data = req.body;
    
    const subscriber = await prisma.subscriber.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        firstName: data.firstName || data.first_name,
        email: data.email,
        howHeard: data.howHeard || data.how_heard,
        stripeCustomerId: data.stripeCustomerId || data.stripe_customer_id,
        stripeSubscriptionId: data.stripeSubscriptionId || data.stripe_subscription_id,
        subscriptionStatus: data.subscriptionStatus || data.subscription_status,
        subscribedSince: data.subscribedSince || data.subscribed_since,
      }
    });
    
    res.json(subscriber);
  } catch (error) {
    console.error('Error updating subscriber:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== RECIPIENTS ====================

// Get all recipients
app.get('/api/recipients', async (req, res) => {
  try {
    const { subscriber_id, created_by_id } = req.query;
    
    const where = {};
    if (subscriber_id) where.subscriberId = subscriber_id;
    if (created_by_id) where.createdById = created_by_id;
    
    const recipients = await prisma.recipient.findMany({
      where,
      include: {
        subscriber: true,
        owner: true,
      }
    });
    
    res.json(recipients);
  } catch (error) {
    console.error('Error fetching recipients:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single recipient
app.get('/api/recipients/:id', async (req, res) => {
  try {
    const recipient = await prisma.recipient.findUnique({
      where: { id: req.params.id },
      include: {
        subscriber: true,
        owner: true,
        giftLists: {
          include: {
            giftItems: true,
          }
        }
      }
    });
    
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    res.json(recipient);
  } catch (error) {
    console.error('Error fetching recipient:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create recipient
app.post('/api/recipients', async (req, res) => {
  try {
    const data = req.body;
    
    const recipient = await prisma.recipient.create({
      data: {
        name: data.name,
        relationship: data.relationship,
        occasion: data.occasion,
        occasionDay: data.occasionDay || data.occasion_day,
        occasionMonth: data.occasionMonth || data.occasion_month,
        occasions: data.occasions,
        birthday: data.birthday,
        gender: data.gender,
        ageRange: data.ageRange || data.age_range,
        childAgeBracket: data.childAgeBracket || data.child_age_bracket,
        ageBand: data.ageBand || data.age_band,
        budgetMin: data.budgetMin || data.budget_min,
        budgetMax: data.budgetMax || data.budget_max,
        interests: data.interests || [],
        personality: data.personality || [],
        giftTypes: data.giftTypes || data.gift_types || [],
        avoidNotes: data.avoidNotes || data.avoid_notes,
        whoTheyAre: data.whoTheyAre || data.who_they_are,
        hobbiesAndInterests: data.hobbiesAndInterests || data.hobbies_and_interests,
        thingsYouKnow: data.thingsYouKnow || data.things_you_know,
        milestones: data.milestones,
        involvementLevel: data.involvementLevel || data.involvement_level,
        commsPreferences: data.commsPreferences || data.comms_preferences,
        notes: data.notes,
        subscriberId: data.subscriberId || data.subscriber_id,
        createdById: data.createdById || data.created_by_id,
      }
    });
    
    res.status(201).json(recipient);
  } catch (error) {
    console.error('Error creating recipient:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update recipient
app.patch('/api/recipients/:id', async (req, res) => {
  try {
    const data = req.body;
    
    const recipient = await prisma.recipient.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        relationship: data.relationship,
        occasion: data.occasion,
        occasionDay: data.occasionDay || data.occasion_day,
        occasionMonth: data.occasionMonth || data.occasion_month,
        occasions: data.occasions,
        birthday: data.birthday,
        gender: data.gender,
        ageRange: data.ageRange || data.age_range,
        childAgeBracket: data.childAgeBracket || data.child_age_bracket,
        ageBand: data.ageBand || data.age_band,
        budgetMin: data.budgetMin || data.budget_min,
        budgetMax: data.budgetMax || data.budget_max,
        interests: data.interests,
        personality: data.personality,
        giftTypes: data.giftTypes || data.gift_types,
        avoidNotes: data.avoidNotes || data.avoid_notes,
        whoTheyAre: data.whoTheyAre || data.who_they_are,
        hobbiesAndInterests: data.hobbiesAndInterests || data.hobbies_and_interests,
        thingsYouKnow: data.thingsYouKnow || data.things_you_know,
        milestones: data.milestones,
        involvementLevel: data.involvementLevel || data.involvement_level,
        commsPreferences: data.commsPreferences || data.comms_preferences,
        notes: data.notes,
      }
    });
    
    res.json(recipient);
  } catch (error) {
    console.error('Error updating recipient:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete recipient
app.delete('/api/recipients/:id', async (req, res) => {
  try {
    await prisma.recipient.delete({
      where: { id: req.params.id }
    });
    
    res.json({ success: true, id: req.params.id });
  } catch (error) {
    console.error('Error deleting recipient:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== GIFT LISTS ====================

// Get all gift lists
app.get('/api/gift-lists', async (req, res) => {
  try {
    const { recipient_id, subscriber_id, status } = req.query;
    
    const where = {};
    if (recipient_id) where.recipientId = recipient_id;
    if (subscriber_id) where.subscriberId = subscriber_id;
    if (status) where.status = status;
    
    const giftLists = await prisma.giftList.findMany({
      where,
      include: {
        recipient: true,
        subscriber: true,
        giftItems: true,
      }
    });
    
    res.json(giftLists);
  } catch (error) {
    console.error('Error fetching gift lists:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single gift list
app.get('/api/gift-lists/:id', async (req, res) => {
  try {
    const giftList = await prisma.giftList.findUnique({
      where: { id: req.params.id },
      include: {
        recipient: true,
        subscriber: true,
        giftItems: {
          include: {
            product: {
              include: {
                retailer: true,
              }
            }
          }
        }
      }
    });
    
    if (!giftList) {
      return res.status(404).json({ error: 'Gift list not found' });
    }
    
    res.json(giftList);
  } catch (error) {
    console.error('Error fetching gift list:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PRODUCTS ====================

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const { status, retailer_id, limit = 100 } = req.query;
    
    const where = {};
    if (status) where.status = status;
    if (retailer_id) where.retailerId = retailer_id;
    
    const products = await prisma.product.findMany({
      where,
      include: {
        retailer: true,
      },
      take: parseInt(limit),
    });
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single product
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        retailer: true,
      }
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: error.message });
  }
});

// Catch-all route for React Router (must be after API routes)
if (NODE_ENV === 'production') {
  app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: PostgreSQL via Prisma`);
  console.log(`🔧 Environment: ${NODE_ENV}`);
  console.log(`🔧 Available endpoints:`);
  console.log(`   - GET  /api/health`);
  console.log(`   - GET  /api/subscribers`);
  console.log(`   - POST /api/subscribers`);
  console.log(`   - GET  /api/recipients`);
  console.log(`   - POST /api/recipients`);
  console.log(`   - GET  /api/gift-lists`);
  console.log(`   - GET  /api/products`);
  console.log(`\n✨ Ready to serve data from your PostgreSQL database!\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
