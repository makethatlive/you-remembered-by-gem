/**
 * Simple Express API server for local development
 * Provides REST endpoints to access PostgreSQL data via Prisma
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { PrismaClient } from '@prisma/client';
import { sendEmail, sendWelcomeEmail, sendApprovalEmail, sendBirthdayReminder } from './services/email/resend-client.js';
import authRoutes from './routes/auth-routes.js';
import { runForensicAudit } from './services/audit/forensic-audit-service.js';
import ClaudeClient from './services/ai/claude-client.js';
import GiftListGenerator from './services/gifts/gift-list-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate days until next occurrence of a birthday
 * @param {number} day - Day of month (1-31)
 * @param {number} month - Month (1-12)
 * @returns {number|null} Days until birthday, or null if invalid date
 */
function calculateDaysUntilBirthday(day, month) {
  if (!day || !month) return null;
  
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Create date for this year's birthday
  let nextBirthday = new Date(currentYear, month - 1, day);
  
  // If birthday has already passed this year, use next year
  if (nextBirthday < now) {
    nextBirthday = new Date(currentYear + 1, month - 1, day);
  }
  
  // Calculate difference in days
  const diffTime = nextBirthday.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}

// ==================== UTILITY FUNCTIONS ====================
function toCamelCase(str) {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function toSnakeCase(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function convertKeysToCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToCamelCase);
  }
  if (obj && typeof obj === 'object' && obj.constructor === Object) {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = toCamelCase(key);
      newObj[camelKey] = convertKeysToCamelCase(value);
    }
    return newObj;
  }
  return obj;
}

function convertKeysToSnakeCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertKeysToSnakeCase);
  }
  if (obj && typeof obj === 'object' && obj.constructor === Object) {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = toSnakeCase(key);
      newObj[snakeKey] = convertKeysToSnakeCase(value);
    }
    return newObj;
  }
  return obj;
}

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Serve static files from dist folder in production
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API server running' });
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route works!' });
});

// ==================== AUTHENTICATION ====================
app.use('/api/auth', authRoutes);

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
    
    // NOTE: Welcome email is sent during registration (auth-routes.js)
    // Don't send it here to avoid duplicates
    
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
    
    // Transform gender to uppercase enum if provided
    let gender = data.gender;
    if (gender && typeof gender === 'string') {
      gender = gender.toUpperCase().replace(/\s+/g, '_');
    }
    
    // Age band - now uses flexible ranges directly from onboarding form
    // No transformation needed - values like "1-2", "18-25", "75+" are stored as-is
    const ageBand = data.ageBand || data.age_band;
    
    // Get createdById from subscriber if not provided
    let createdById = data.createdById || data.created_by_id;
    const subscriberId = data.subscriberId || data.subscriber_id;
    
    if (!createdById && subscriberId) {
      // Look up the subscriber to get their createdById (owner)
      const subscriber = await prisma.subscriber.findUnique({
        where: { id: subscriberId },
        select: { createdById: true }
      });
      
      if (subscriber) {
        createdById = subscriber.createdById;
      }
    }
    
    if (!createdById) {
      return res.status(400).json({ 
        error: 'createdById is required and could not be determined from subscriber' 
      });
    }
    
    const recipient = await prisma.recipient.create({
      data: {
        name: data.name,
        relationship: data.relationship,
        occasion: data.occasion,
        occasionDay: data.occasionDay || data.occasion_day,
        occasionMonth: data.occasionMonth || data.occasion_month,
        occasions: data.occasions,
        birthday: data.birthday,
        gender: gender,
        ageRange: data.ageRange || data.age_range,
        childAgeBracket: data.childAgeBracket || data.child_age_bracket,
        ageBand: ageBand,
        budgetMin: data.budgetMin || data.budget_min,
        budgetMax: data.budgetMax || data.budget_max,
        interests: data.interests || [],
        interestsDetail: data.interestsDetail || data.interests_detail,
        personality: data.personality || [],
        personalityOther: data.personalityOther || data.personality_other,
        giftTypes: data.giftTypes || data.gift_types || [],
        giftTypesOther: data.giftTypesOther || data.gift_types_other,
        avoidNotes: data.avoidNotes || data.avoid_notes,
        whoTheyAre: data.whoTheyAre || data.who_they_are,
        hobbiesAndInterests: data.hobbiesAndInterests || data.hobbies_and_interests,
        thingsYouKnow: data.thingsYouKnow || data.things_you_know,
        milestones: data.milestones,
        involvementLevel: data.involvementLevel || data.involvement_level,
        commsPreferences: data.commsPreferences || data.comms_preferences,
        notes: data.notes,
        subscriberId: subscriberId,
        createdById: createdById,
      }
    });

    // AUTO-GENERATE GIFT LIST (6-WEEK LOGIC)
    // Calculate days until next birthday
    const daysUntil = calculateDaysUntilBirthday(
      data.occasionDay || data.occasion_day, 
      data.occasionMonth || data.occasion_month
    );
    
    console.log(`\n🎂 Recipient created: ${recipient.name}`);
    console.log(`   Days until birthday: ${daysUntil}`);
    
    // If birthday is within 6 weeks (42 days), auto-generate gift list
    if (daysUntil !== null && daysUntil <= 42) {
      console.log(`   ⚡ Auto-generating gift list (≤ 6 weeks away)...`);
      
      // Trigger gift generation asynchronously (don't wait for it)
      setImmediate(async () => {
        try {
          const apiKey = process.env.ANTHROPIC_API_KEY;
          if (!apiKey) {
            console.error('   ❌ Cannot auto-generate: ANTHROPIC_API_KEY not set');
            return;
          }
          
          const claudeClient = new ClaudeClient(apiKey, prisma);
          const generator = new GiftListGenerator(claudeClient, prisma);
          
          const result = await generator.generateGiftList({
            recipientId: recipient.id,
            listType: 'curated',
            daysUntil: daysUntil,
          });
          
          if (result.status === 'pending_approval') {
            console.log(`   ✅ Auto-generated gift list: ${result.giftListId}`);
          } else {
            console.log(`   ⚠️  Generation result: ${result.status} - ${result.message}`);
          }
        } catch (error) {
          console.error(`   ❌ Auto-generation failed: ${error.message}`);
        }
      });
    } else if (daysUntil !== null) {
      console.log(`   ⏰ Gift list will auto-generate when recipient reaches 6 weeks before birthday`);
    }
    
    res.status(201).json(recipient);
  } catch (error) {
    console.error('Error creating recipient:', error);
    console.error('Request data:', req.body);
    res.status(500).json({ error: error.message });
  }
});

// Update recipient
app.patch('/api/recipients/:id', async (req, res) => {
  try {
    const data = req.body;
    
    // Transform gender to uppercase enum if provided
    let gender = data.gender;
    if (gender && typeof gender === 'string') {
      gender = gender.toUpperCase().replace(/\s+/g, '_');
    }
    
    // Age band - now uses flexible ranges directly from onboarding form
    // No transformation needed - values like "1-2", "18-25", "75+" are stored as-is
    const ageBand = data.ageBand || data.age_band;
    
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
        gender: gender,
        ageRange: data.ageRange || data.age_range,
        childAgeBracket: data.childAgeBracket || data.child_age_bracket,
        ageBand: ageBand,
        budgetMin: data.budgetMin || data.budget_min,
        budgetMax: data.budgetMax || data.budget_max,
        interests: data.interests,
        interestsDetail: data.interestsDetail || data.interests_detail,
        personality: data.personality,
        personalityOther: data.personalityOther || data.personality_other,
        giftTypes: data.giftTypes || data.gift_types,
        giftTypesOther: data.giftTypesOther || data.gift_types_other,
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
    console.error('Request data:', req.body);
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

// Update gift list (for approval, rejection, etc.)
app.patch('/api/gift-lists/:id', async (req, res) => {
  try {
    const data = req.body;
    
    // Map snake_case (from Base44 SDK) to camelCase (Prisma)
    const fieldMapping = {
      list_type: 'listType',
      rejection_reason: 'rejectionReason',
      rejection_note: 'rejectionNote',
      approved_at: 'approvedAt',
      visible_to_subscriber: 'visibleToSubscriber',
      supersedes_list_id: 'supersedesListId',
      refresh_requested_at: 'refreshRequestedAt',
      refresh_reason: 'refreshReason',
      ai_prompt_used: 'aiPromptUsed',
      recipient_id: 'recipientId',
      subscriber_id: 'subscriberId',
      subscriber_user_id: 'subscriberUserId',
      birthday_date: 'birthdayDate',
      generated_at: 'generatedAt'
    };
    
    const updateData = {};
    for (const [key, value] of Object.entries(data)) {
      const mappedKey = fieldMapping[key] || key;
      updateData[mappedKey] = value;
    }
    
    // Normalize enum values to uppercase if provided
    if (updateData.status) updateData.status = updateData.status.toUpperCase();
    if (updateData.listType) updateData.listType = updateData.listType.toUpperCase();
    if (updateData.rejectionReason) updateData.rejectionReason = updateData.rejectionReason.toUpperCase();
    
    const giftList = await prisma.giftList.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        recipient: true,
        subscriber: true,
      }
    });
    
    // If status changed to APPROVED, send approval email
    if (updateData.status === 'APPROVED' && giftList.subscriber && giftList.recipient) {
      try {
        // Get gift items count
        const giftItems = await prisma.giftItem.count({
          where: { 
            giftListId: giftList.id,
            status: 'ACTIVE'
          }
        });
        
        console.log(`📧 Sending approval email for gift list ${giftList.id} to ${giftList.subscriber.email}`);
        
        await sendApprovalEmail(
          giftList.subscriber.email,
          giftList.subscriber.firstName || giftList.subscriber.name,
          giftList.recipient.name,
          giftItems,
          giftList.subscriberId,
          giftList.recipientId,
          giftList.id
        );
        
        console.log(`✅ Approval email sent successfully`);
      } catch (emailError) {
        console.error('❌ Error sending approval email:', emailError);
        // Don't fail the approval if email fails
      }
    }
    
    res.json(giftList);
  } catch (error) {
    console.error('Error updating gift list:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== GIFT ITEMS ====================

// Get all gift items
app.get('/api/gift-items', async (req, res) => {
  try {
    const { gift_list_id, subscriber_user_id, status } = req.query;
    
    const where = {};
    if (gift_list_id) where.giftListId = gift_list_id;
    if (subscriber_user_id) where.subscriberUserId = subscriber_user_id;
    if (status) where.status = status;
    
    const giftItems = await prisma.giftItem.findMany({
      where,
      include: {
        giftList: {
          include: {
            recipient: true,
          }
        },
        product: {
          include: {
            retailer: true,
          }
        }
      }
    });
    
    res.json(giftItems);
  } catch (error) {
    console.error('Error fetching gift items:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single gift item
app.get('/api/gift-items/:id', async (req, res) => {
  try {
    const giftItem = await prisma.giftItem.findUnique({
      where: { id: req.params.id },
      include: {
        giftList: {
          include: {
            recipient: true,
          }
        },
        product: {
          include: {
            retailer: true,
          }
        }
      }
    });
    
    if (!giftItem) {
      return res.status(404).json({ error: 'Gift item not found' });
    }
    
    res.json(giftItem);
  } catch (error) {
    console.error('Error fetching gift item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update gift item (for admin feedback, status changes, etc.)
app.patch('/api/gift-items/:id', async (req, res) => {
  try {
    const data = req.body;
    
    // Map snake_case (from Base44 SDK) to camelCase (Prisma)
    const fieldMapping = {
      subscriber_action: 'subscriberAction',
      admin_feedback_reason: 'adminFeedbackReason',
      admin_feedback_note: 'adminFeedbackNote',
      source_type: 'sourceType',
      delivery_speed: 'deliverySpeed',
      selection_score: 'selectionScore',
      matched_signals: 'matchedSignals',
      product_id: 'productId',
      gift_list_id: 'giftListId'
    };
    
    const updateData = {};
    for (const [key, value] of Object.entries(data)) {
      const mappedKey = fieldMapping[key] || key;
      updateData[mappedKey] = value;
    }
    
    // Normalize enum values to uppercase if provided
    if (updateData.status) updateData.status = updateData.status.toUpperCase();
    if (updateData.subscriberAction) updateData.subscriberAction = updateData.subscriberAction.toUpperCase();
    if (updateData.feedback) updateData.feedback = updateData.feedback.toUpperCase();
    if (updateData.adminFeedbackReason) updateData.adminFeedbackReason = updateData.adminFeedbackReason.toUpperCase();
    if (updateData.sourceType) updateData.sourceType = updateData.sourceType.toUpperCase();
    if (updateData.deliverySpeed) updateData.deliverySpeed = updateData.deliverySpeed.toUpperCase();
    
    const giftItem = await prisma.giftItem.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        giftList: true,
        product: true,
      }
    });
    
    res.json(giftItem);
  } catch (error) {
    console.error('Error updating gift item:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create gift item (for manual gift entry and catalogue swaps)
app.post('/api/gift-items', async (req, res) => {
  try {
    const data = req.body;
    
    // Normalize enum values to uppercase if provided
    const createData = { ...data };
    if (createData.status) createData.status = createData.status.toUpperCase();
    if (createData.subscriberAction) createData.subscriberAction = createData.subscriberAction.toUpperCase();
    if (createData.feedback) createData.feedback = createData.feedback.toUpperCase();
    if (createData.adminFeedbackReason) createData.adminFeedbackReason = createData.adminFeedbackReason.toUpperCase();
    if (createData.sourceType) createData.sourceType = createData.sourceType.toUpperCase();
    if (createData.deliverySpeed) createData.deliverySpeed = createData.deliverySpeed.toUpperCase();
    
    // Rename snake_case fields to camelCase for Prisma
    const prismaData = {
      giftListId: createData.gift_list_id,
      subscriberUserId: createData.subscriber_user_id,
      productId: createData.product_id,
      title: createData.title,
      description: createData.description,
      whyThisGift: createData.why_this_gift,
      productUrl: createData.product_url,
      affiliateUrl: createData.affiliate_url,
      retailerName: createData.retailer_name,
      price: createData.price,
      imageUrl: createData.image_url,
      sourceType: createData.sourceType || createData.source_type?.toUpperCase(),
      deliverySpeed: createData.deliverySpeed || createData.delivery_speed?.toUpperCase(),
      status: createData.status || 'ACTIVE',
      selectionScore: createData.selection_score,
      matchedSignals: createData.matched_signals,
      suitabilityConfidence: createData.suitability_confidence,
      suitabilityReasoning: createData.suitability_reasoning,
      aiFlagConcern: createData.ai_flag_concern,
    };
    
    // Remove undefined fields
    Object.keys(prismaData).forEach(key => {
      if (prismaData[key] === undefined) {
        delete prismaData[key];
      }
    });
    
    const giftItem = await prisma.giftItem.create({
      data: prismaData,
      include: {
        giftList: true,
        product: true,
      }
    });
    
    res.json(giftItem);
  } catch (error) {
    console.error('Error creating gift item:', error);
    
    // Better error messages for foreign key violations
    if (error.code === 'P2003') {
      const field = error.meta?.field_name || 'unknown';
      if (field.includes('product_id')) {
        return res.status(400).json({ error: 'Product ID does not exist in database' });
      } else if (field.includes('gift_list_id')) {
        return res.status(400).json({ error: 'Gift list ID does not exist in database' });
      }
      return res.status(400).json({ error: `Foreign key constraint failed on field: ${field}` });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// ==================== GIFT FEEDBACK ====================

// Submit gift feedback from subscriber (standalone endpoint matching base44)
app.post('/api/functions/submitGiftFeedback', async (req, res) => {
  try {
    const { gift_item_id, feedback, subscriber_action } = req.body;
    
    // Validation
    if (!gift_item_id) {
      return res.status(400).json({ error: 'gift_item_id is required' });
    }
    if (!feedback && !subscriber_action) {
      return res.status(400).json({ error: 'feedback or subscriber_action is required' });
    }
    
    const FEEDBACK_VALUES = ['LOVED_IT', 'BAD_SUGGESTION'];
    const ACTION_VALUES = ['PURCHASED', 'NOT_PURCHASED'];
    
    if (feedback && !FEEDBACK_VALUES.includes(feedback.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid feedback value' });
    }
    if (subscriber_action && !ACTION_VALUES.includes(subscriber_action.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid subscriber_action value' });
    }
    
    // Get gift item and verify ownership
    const item = await prisma.giftItem.findUnique({
      where: { id: gift_item_id },
      include: {
        giftList: true
      }
    });
    
    if (!item || !item.giftList) {
      return res.status(404).json({ error: 'Gift item not found' });
    }
    
    // Check if list is visible to subscriber
    if (item.giftList.visibleToSubscriber !== true) {
      return res.status(404).json({ error: 'Gift item not found' });
    }
    
    // Update feedback
    const updates = {};
    if (feedback) updates.feedback = feedback.toUpperCase();
    if (subscriber_action) updates.subscriberAction = subscriber_action.toUpperCase();
    
    await prisma.giftItem.update({
      where: { id: gift_item_id },
      data: updates
    });
    
    res.json({ status: 'ok', ...updates });
  } catch (error) {
    console.error('Error submitting gift feedback:', error);
    res.status(500).json({ error: error.message });
  }
});

// Report Broken Gift function
app.post('/api/functions/reportBrokenGift', async (req, res) => {
  try {
    const { gift_item_id } = req.body;
    
    if (!gift_item_id) {
      return res.status(400).json({ error: 'gift_item_id is required' });
    }
    
    // Get gift item and verify ownership
    const item = await prisma.giftItem.findUnique({
      where: { id: gift_item_id },
      include: {
        giftList: true
      }
    });
    
    if (!item || !item.giftList) {
      return res.status(404).json({ error: 'Gift item not found' });
    }
    
    // Check if list is visible to subscriber
    if (item.giftList.visibleToSubscriber !== true) {
      return res.status(404).json({ error: 'Gift item not found' });
    }
    
    // Mark product as broken if it exists
    if (item.productId && item.productId !== 'manual') {
      await prisma.product.update({
        where: { id: item.productId },
        data: {
          status: 'REPORTED_BROKEN',
          reportedBrokenAt: new Date()
        }
      }).catch(() => null);
    }
    
    // Mark item as removed
    await prisma.giftItem.update({
      where: { id: item.id },
      data: {
        status: 'REMOVED',
        adminFeedbackReason: 'BAD_LINK_OR_DATA',
        adminFeedbackNote: 'Reported by subscriber'
      }
    });
    
    // Get standby items sorted by score
    const standbyItems = await prisma.giftItem.findMany({
      where: {
        giftListId: item.giftListId,
        status: 'STANDBY'
      },
      orderBy: {
        selectionScore: 'desc'
      }
    });
    
    const replacement = standbyItems[0] || null;
    if (replacement) {
      await prisma.giftItem.update({
        where: { id: replacement.id },
        data: { status: 'ACTIVE' }
      });
    }
    
    res.json({
      replaced: !!replacement,
      replacement_title: replacement?.title || ''
    });
  } catch (error) {
    console.error('Error reporting broken gift:', error);
    res.status(500).json({ error: error.message });
  }
});

// Request Gift Refresh function
app.post('/api/functions/requestGiftRefresh', async (req, res) => {
  try {
    const { gift_list_id, refresh_reason } = req.body;
    
    if (!gift_list_id) {
      return res.status(400).json({ error: 'gift_list_id is required' });
    }
    
    // Get gift list and verify ownership
    const list = await prisma.giftList.findUnique({
      where: { id: gift_list_id }
    });
    
    if (!list || list.visibleToSubscriber !== true) {
      return res.status(404).json({ error: 'Gift list not found' });
    }
    
    // Save refresh reason if provided
    const reason = typeof refresh_reason === 'string' ? refresh_reason.trim().slice(0, 300) : '';
    if (reason) {
      await prisma.giftList.update({
        where: { id: list.id },
        data: { refreshReason: reason }
      }).catch(() => {});
    }
    
    // Check if refresh already pending
    const pendingLists = await prisma.giftList.findMany({
      where: {
        recipientId: list.recipientId,
        status: 'PENDING_APPROVAL',
        supersedesListId: list.id
      }
    });
    
    if (pendingLists.length > 0) {
      return res.json({ status: 'already_requested' });
    }
    
    // Check cooldown (24 hours)
    const cooldownCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if (list.refreshRequestedAt && list.refreshRequestedAt > cooldownCutoff) {
      return res.json({ status: 'already_requested' });
    }
    
    // Check for recently rejected lists
    const rejectedLists = await prisma.giftList.findMany({
      where: {
        recipientId: list.recipientId,
        status: 'REJECTED',
        supersedesListId: list.id,
        createdAt: { gte: cooldownCutoff }
      }
    });
    
    if (rejectedLists.length > 0) {
      return res.json({ status: 'already_requested' });
    }
    
    // Update refresh requested timestamp
    await prisma.giftList.update({
      where: { id: list.id },
      data: { refreshRequestedAt: new Date() }
    });
    
    // Get current items to exclude
    const currentItems = await prisma.giftItem.findMany({
      where: { giftListId: list.id },
      select: { productId: true }
    });
    
    const excludeProductIds = currentItems
      .map(item => item.productId)
      .filter(id => id && id !== 'manual');
    
    // Generate new gift list
    try {
      const generateResponse = await fetch(`${process.env.API_URL || 'http://localhost:3001'}/api/generate-gift-list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: list.recipientId,
          list_type: list.listType,
          exclude_product_ids: excludeProductIds,
          supersedes_list_id: list.id
        })
      });
      
      const generateData = await generateResponse.json();
      
      if (!generateResponse.ok || generateData.error || generateData.status !== 'pending_approval') {
        return res.status(422).json({
          error: generateData.error || 'Fresh suggestions could not be prepared'
        });
      }
      
      return res.json({
        status: 'pending_approval',
        giftListId: generateData.giftListId || generateData.data?.giftListId
      });
    } catch (error) {
      console.error('Error generating new gift list:', error);
      return res.status(422).json({
        error: 'Fresh suggestions could not be prepared'
      });
    }
  } catch (error) {
    console.error('Error requesting gift refresh:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== EMAIL LOGS ====================

// Get all email logs
app.get('/api/email-logs', async (req, res) => {
  try {
    const { subscriber_id, recipient_id, email_type, limit = 500 } = req.query;
    
    const where = {};
    if (subscriber_id) where.subscriberId = subscriber_id;
    if (recipient_id) where.recipientId = recipient_id;
    if (email_type) where.emailType = email_type.toUpperCase();
    
    const emailLogs = await prisma.emailLog.findMany({
      where,
      take: parseInt(limit),
      orderBy: {
        sentAt: 'desc',
      },
      include: {
        subscriber: true,
        recipient: true,
        giftList: true,
      }
    });
    
    res.json(emailLogs);
  } catch (error) {
    console.error('Error fetching email logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single email log
app.get('/api/email-logs/:id', async (req, res) => {
  try {
    const emailLog = await prisma.emailLog.findUnique({
      where: { id: req.params.id },
      include: {
        subscriber: true,
        recipient: true,
        giftList: true,
      }
    });
    
    if (!emailLog) {
      return res.status(404).json({ error: 'Email log not found' });
    }
    
    res.json(emailLog);
  } catch (error) {
    console.error('Error fetching email log:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create email log
app.post('/api/email-logs', async (req, res) => {
  try {
    const data = req.body;
    
    // Normalize field names and enum values
    const createData = {
      subscriberId: data.subscriber_id || data.subscriberId,
      recipientId: data.recipient_id || data.recipientId || null,
      giftListId: data.gift_list_id || data.giftListId || null,
      emailType: (data.email_type || data.emailType).toUpperCase(),
      occasionYear: data.occasion_year || data.occasionYear || null,
      sentAt: data.sent_at || data.sentAt || new Date(),
      status: data.status ? data.status.toUpperCase() : 'SENT',
    };
    
    const emailLog = await prisma.emailLog.create({
      data: createData,
      include: {
        subscriber: true,
        recipient: true,
        giftList: true,
      }
    });
    
    res.json(emailLog);
  } catch (error) {
    console.error('Error creating email log:', error);
    res.status(500).json({ error: error.message, details: error.toString() });
  }
});

// ==================== USERS ====================

// Get all users
app.get('/api/users', async (req, res) => {
  try {
    const { limit = 200 } = req.query;
    
    const users = await prisma.user.findMany({
      take: parseInt(limit),
      orderBy: {
        createdAt: 'desc',
      }
    });
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single user
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        subscribers: true,
        recipients: true,
      }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user (role change)
app.patch('/api/users/:id', async (req, res) => {
  try {
    const data = req.body;
    
    // Transform role to uppercase if provided
    let role = data.role;
    if (role && typeof role === 'string') {
      role = role.toUpperCase();
    }
    
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        email: data.email,
        role: role,
      }
    });
    
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    console.error('Request data:', req.body);
    res.status(500).json({ error: error.message });
  }
});

// Invite a new user
app.post('/api/users/invite', async (req, res) => {
  try {
    const { email, role = 'user' } = req.body;
    
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email is required' });
    }
    
    const normalizedRole = role.toUpperCase();
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }
    
    // Create a new user with invited status
    const user = await prisma.user.create({
      data: {
        email,
        role: normalizedRole,
        // In a real implementation, you'd generate a secure invitation token here
        // and store it or send it in the email
      }
    });
    
    // Send invitation email
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/signup?email=${encodeURIComponent(email)}&token=invite`;
    
    const emailSubject = '🎁 You\'re invited to You Remembered By Gem';
    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #2dd4bf, #0d9488); color: white; padding: 30px; text-align: center; border-radius: 10px; }
          .content { background: #fff; padding: 30px; border-radius: 10px; margin-top: 20px; }
          .button { display: inline-block; background: #2dd4bf; color: white; padding: 12px 30px; text-decoration: none; border-radius: 25px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎁 Welcome to You Remembered By Gem!</h1>
          </div>
          <div class="content">
            <p>Hi there!</p>
            
            <p>You've been invited to join You Remembered By Gem${normalizedRole === 'ADMIN' ? ' as an administrator' : ''}. We help you never forget a special occasion and always find the perfect gift.</p>
            
            <p><strong>What you'll get:</strong></p>
            <ul>
              <li>🎂 Birthday and occasion reminders</li>
              <li>🎁 AI-powered personalized gift suggestions</li>
              <li>📝 Organized gift lists for everyone you care about</li>
              <li>🔔 Timely notifications so you're always prepared</li>
            </ul>
            
            <p>Click the button below to set up your account:</p>
            
            <a href="${inviteLink}" class="button">Accept Invitation</a>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #2dd4bf;">${inviteLink}</p>
            
            <p>If you have any questions, just reply to this email - we're here to help!</p>
            
            <p>Best regards,<br>The Gem Team</p>
          </div>
          <div class="footer">
            <p>You received this email because someone invited you to You Remembered By Gem.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    // Send invitation email (non-blocking)
    sendEmail({
      to: email,
      subject: emailSubject,
      html: emailHtml,
    }).then(result => {
      if (result.success) {
        console.log(`✅ Invitation email sent to ${email}`);
      } else {
        console.error(`❌ Failed to send invitation email to ${email}`);
      }
    }).catch(err => {
      console.error(`❌ Error sending invitation email to ${email}:`, err);
    });
    
    res.json({ 
      success: true, 
      message: 'Invitation sent successfully',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      }
    });
  } catch (error) {
    console.error('Error inviting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== RETAILERS ====================

// Get all retailers
app.get('/api/retailers', async (req, res) => {
  try {
    const { limit = 200 } = req.query;
    
    const retailers = await prisma.retailer.findMany({
      take: parseInt(limit),
      orderBy: {
        name: 'asc',
      }
    });
    
    res.json(retailers);
  } catch (error) {
    console.error('Error fetching retailers:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single retailer
app.get('/api/retailers/:id', async (req, res) => {
  try {
    const retailer = await prisma.retailer.findUnique({
      where: { id: req.params.id },
    });
    
    if (!retailer) {
      return res.status(404).json({ error: 'Retailer not found' });
    }
    
    res.json(retailer);
  } catch (error) {
    console.error('Error fetching retailer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create a new retailer
app.post('/api/retailers', async (req, res) => {
  try {
    // Convert snake_case to camelCase for Prisma
    const data = convertKeysToCamelCase(req.body);
    
    const retailer = await prisma.retailer.create({
      data,
    });
    
    console.log('✅ Retailer created:', retailer.id, retailer.name);
    res.status(201).json(retailer);
  } catch (error) {
    console.error('Error creating retailer:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a retailer
app.patch('/api/retailers/:id', async (req, res) => {
  try {
    // Convert snake_case to camelCase for Prisma
    const data = convertKeysToCamelCase(req.body);
    
    const retailer = await prisma.retailer.update({
      where: { id: req.params.id },
      data,
    });
    
    console.log('✅ Retailer updated:', retailer.id, retailer.name);
    res.json(retailer);
  } catch (error) {
    console.error('Error updating retailer:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== PRODUCTS ====================

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const { status, retailer_id, limit = 10000 } = req.query; // Default to 10000 for large catalogs
    
    const where = {};
    if (status) where.status = status;
    if (retailer_id) where.retailerId = retailer_id;
    
    const products = await prisma.product.findMany({
      where,
      include: {
        retailer: true,
      },
      orderBy: {
        addedDate: 'desc', // Newest products first
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

// Create a new product
app.post('/api/products', async (req, res) => {
  try {
    // Convert snake_case to camelCase for Prisma
    const data = convertKeysToCamelCase(req.body);
    
    // Normalize status to uppercase if provided
    if (data.status && typeof data.status === 'string') {
      data.status = data.status.toUpperCase();
    }
    
    // Normalize sourceType to uppercase if provided
    if (data.sourceType && typeof data.sourceType === 'string') {
      data.sourceType = data.sourceType.toUpperCase();
    }
    
    const product = await prisma.product.create({
      data,
      include: {
        retailer: true,
      }
    });
    
    console.log('✅ Product created:', product.id, product.name);
    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a product
app.patch('/api/products/:id', async (req, res) => {
  try {
    console.log('📋 Updating product:', req.params.id);
    console.log('📦 Update data:', req.body);
    
    // Convert snake_case to camelCase for Prisma
    const data = convertKeysToCamelCase(req.body);
    
    // Normalize status to uppercase if provided
    if (data.status && typeof data.status === 'string') {
      data.status = data.status.toUpperCase();
    }
    
    // Normalize sourceType to uppercase if provided
    if (data.sourceType && typeof data.sourceType === 'string') {
      data.sourceType = data.sourceType.toUpperCase();
    }
    
    const product = await prisma.product.update({
      where: { id: req.params.id },
      data,
      include: {
        retailer: true,
      }
    });
    
    console.log('✅ Product updated:', product.id, product.name);
    res.json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check availability batch (for "Re-run Scrape" button)
app.post('/api/products/check-availability-batch', requireAdmin, async (req, res) => {
  try {
    const { cursor = 0, batch_size = 25 } = req.body;

    console.log(`🔍 Starting availability check batch (cursor: ${cursor}, batch_size: ${batch_size})`);

    // Import availability checker service
    const { checkAvailabilityBatch } = await import('./services/products/availability-checker.js');

    // Execute availability check
    const result = await checkAvailabilityBatch(prisma, {
      cursor: Number(cursor),
      batchSize: Number(batch_size),
    });

    console.log(`✅ Batch complete: ${result.processed} processed, next_cursor: ${result.next_cursor}, done: ${result.done}`);

    res.json(result);
  } catch (error) {
    console.error('Error in availability check batch:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/products/recover-catalogue
 * Recover old catalogue - sift through inactive products and move plausible ones to needs_review
 * Admin-only. Useful after an overzealous link-check.
 */
app.post('/api/products/recover-catalogue', requireAdmin, async (req, res) => {
  try {
    console.log('🔄 Starting catalogue recovery...');

    // Import catalogue recovery service
    const { recoverInactiveCatalogue } = await import('./services/products/recover-catalogue.js');

    // Execute recovery
    const result = await recoverInactiveCatalogue(prisma);

    console.log(`✅ Recovery complete: checked ${result.checked}, recovered ${result.recovered_to_review}, confirmed gone ${result.confirmed_gone}, excluded ${result.excluded_as_junk}`);

    res.json(result);
  } catch (error) {
    console.error('Error in catalogue recovery:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== GIFT GENERATION ====================

/**
 * Generate a gift list for a recipient using Claude AI
 * POST /api/generate-gift-list
 */
app.post('/api/generate-gift-list', async (req, res) => {
  try {
    const { recipient_id, list_type = 'curated', days_until, exclude_product_ids = [], supersedes_list_id } = req.body;

    if (!recipient_id) {
      return res.status(400).json({ error: 'recipient_id is required' });
    }

    // Check for Claude API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'Claude API key not configured',
        message: 'Please add ANTHROPIC_API_KEY to your .env file. Get a key from: https://console.anthropic.com/',
        docs: 'Visit https://console.anthropic.com/ to obtain your API key'
      });
    }

    // Validate API key format (Claude keys start with 'sk-ant-')
    if (!apiKey.startsWith('sk-ant-')) {
      return res.status(500).json({
        error: 'Invalid Claude API key format',
        message: 'Your API key should start with "sk-ant-".',
        currentKeyStarts: apiKey.substring(0, 10) + '...',
        currentKeyLength: apiKey.length,
        docs: 'Visit https://console.anthropic.com/ to obtain a valid API key'
      });
    }

    console.log(`\n🎁 Generating gift list for recipient: ${recipient_id}`);
    console.log(`📝 List type: ${list_type}`);
    console.log(`📅 Days until: ${days_until || 'not specified'}`);

    // Import the service modules (ESM)
    const { default: ClaudeClient } = await import('./services/ai/claude-client.js');
    const { default: GiftListGenerator } = await import('./services/gifts/gift-list-generator.js');

    // Initialize services
    console.log('🤖 Initializing Claude AI client...');
    const claudeClient = new ClaudeClient(apiKey, prisma);
    const generator = new GiftListGenerator(claudeClient, prisma);

    // Generate the gift list
    const result = await generator.generateGiftList({
      recipientId: recipient_id,
      listType: list_type,
      daysUntil: days_until,
      excludeProductIds: exclude_product_ids,
      supersedesListId: supersedes_list_id,
    });

    console.log(`✅ Gift list generated successfully!`);
    console.log(`   - Status: ${result.status}`);
    console.log(`   - Items: ${result.giftList?.itemCount || 0}`);
    console.log(`   - Candidates evaluated: ${result.stats?.candidatesEvaluated || 0}\n`);

    // Return success response
    res.status(200).json({
      success: true,
      data: result,
    });

  } catch (error) {
    console.error('\n❌ Error generating gift list:');
    console.error('   Message:', error.message);
    if (NODE_ENV === 'development') {
      console.error('   Stack:', error.stack);
    }
    console.error('');
    
    res.status(500).json({ 
      error: error.message,
      details: NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Catch-all route for React Router (must be after API routes)
// Using middleware instead of route to avoid path-to-regexp issues
if (NODE_ENV === 'production') {
  app.use((req, res, next) => {
    // Only handle GET requests that aren't API calls
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../dist/index.html'));
    } else {
      next();
    }
  });
}

// ==================== SCRAPER ENDPOINTS ====================

// Get scrape state
app.get('/api/scrape-state', async (req, res) => {
  try {
    const scrapeStates = await prisma.scrapeState.findMany({
      orderBy: { id: 'desc' },
    });
    res.json(scrapeStates);
  } catch (error) {
    console.error('Error fetching scrape state:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single scrape state by id
app.get('/api/scrape-state/:id', async (req, res) => {
  try {
    const scrapeState = await prisma.scrapeState.findUnique({
      where: { id: req.params.id },
    });
    if (!scrapeState) {
      return res.status(404).json({ error: 'Scrape state not found' });
    }
    res.json(scrapeState);
  } catch (error) {
    console.error('Error fetching scrape state:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Simple admin check middleware
 * TODO: Replace with proper JWT/session authentication
 */
function requireAdmin(req, res, next) {
  // For now, allow all requests in development
  // In production, this should check JWT token or session
  const adminKey = req.headers['x-admin-key'];
  
  // Skip check if ADMIN_API_KEY is not set (authentication disabled)
  if (!process.env.ADMIN_API_KEY) {
    return next();
  }
  
  if (process.env.NODE_ENV === 'production' && adminKey !== process.env.ADMIN_API_KEY) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ==================== AI API CALL LOGS ENDPOINTS ====================

/**
 * GET /api/admin/ai-logs
 * Get paginated list of AI API call logs with filters
 * Query params:
 *   - page: Page number (default: 1)
 *   - limit: Items per page (default: 50, max: 200)
 *   - status: Filter by status (SUCCESS, ERROR, TIMEOUT)
 *   - callType: Filter by call type (PROFILE_ANALYSIS, GIFT_SELECTION, PRODUCT_CLASSIFICATION)
 *   - recipientId: Filter by recipient
 *   - giftListId: Filter by gift list
 *   - startDate: Filter from date (ISO string)
 *   - endDate: Filter to date (ISO string)
 */
app.get('/api/admin/ai-logs', requireAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      callType,
      recipientId,
      giftListId,
      startDate,
      endDate
    } = req.query;
    
    // Parse and validate pagination
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 50));
    const skip = (pageNum - 1) * limitNum;
    
    // Build where clause
    const where = {};
    
    if (status) {
      where.status = status.toUpperCase();
    }
    
    if (callType) {
      where.callType = callType.toUpperCase();
    }
    
    if (recipientId) {
      where.recipientId = recipientId;
    }
    
    if (giftListId) {
      where.giftListId = giftListId;
    }
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }
    
    // Get total count for pagination
    const total = await prisma.aIApiCallLog.count({ where });
    
    // Get logs
    const logs = await prisma.aIApiCallLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
    });
    
    res.json({
      logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      }
    });
    
  } catch (error) {
    console.error('Error fetching AI logs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/ai-stats
 * Get aggregated statistics for AI API calls
 * Query params:
 *   - startDate: Filter from date (ISO string)
 *   - endDate: Filter to date (ISO string)
 *   - groupBy: Group by period (day, week, month) - optional
 */
app.get('/api/admin/ai-stats', requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, groupBy } = req.query;
    
    // Build where clause for date range
    const where = {};
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }
    
    // Get all logs in range for aggregation
    const logs = await prisma.aIApiCallLog.findMany({
      where,
      select: {
        id: true,
        callType: true,
        status: true,
        provider: true,
        model: true,
        inputTokens: true,
        outputTokens: true,
        costUsd: true,
        durationMs: true,
        createdAt: true,
      }
    });
    
    // Calculate overall stats
    const totalCalls = logs.length;
    const successfulCalls = logs.filter(log => log.status === 'SUCCESS').length;
    const errorCalls = logs.filter(log => log.status === 'FAILED').length;
    const timeoutCalls = logs.filter(log => log.status === 'TIMEOUT').length;
    
    const totalCost = logs.reduce((sum, log) => sum + (log.costUsd || 0), 0);
    const totalInputTokens = logs.reduce((sum, log) => sum + (log.inputTokens || 0), 0);
    const totalOutputTokens = logs.reduce((sum, log) => sum + (log.outputTokens || 0), 0);
    const totalTokens = totalInputTokens + totalOutputTokens;
    
    const avgDuration = logs.length > 0 
      ? logs.reduce((sum, log) => sum + (log.durationMs || 0), 0) / logs.length 
      : 0;
    
    // Stats by call type
    const byCallType = {};
    logs.forEach(log => {
      if (!byCallType[log.callType]) {
        byCallType[log.callType] = {
          count: 0,
          successCount: 0,
          errorCount: 0,
          totalCost: 0,
          totalTokens: 0,
          avgDuration: 0,
        };
      }
      
      byCallType[log.callType].count++;
      if (log.status === 'SUCCESS') byCallType[log.callType].successCount++;
      if (log.status === 'FAILED') byCallType[log.callType].errorCount++;
      byCallType[log.callType].totalCost += log.costUsd || 0;
      byCallType[log.callType].totalTokens += (log.inputTokens || 0) + (log.outputTokens || 0);
    });
    
    // Calculate averages for each call type
    Object.keys(byCallType).forEach(type => {
      const stats = byCallType[type];
      const typeLogs = logs.filter(log => log.callType === type);
      stats.avgDuration = typeLogs.length > 0
        ? typeLogs.reduce((sum, log) => sum + (log.durationMs || 0), 0) / typeLogs.length
        : 0;
    });
    
    // Stats by provider
    const byProvider = {};
    logs.forEach(log => {
      if (!byProvider[log.provider]) {
        byProvider[log.provider] = {
          count: 0,
          totalCost: 0,
          totalTokens: 0,
        };
      }
      
      byProvider[log.provider].count++;
      byProvider[log.provider].totalCost += log.costUsd || 0;
      byProvider[log.provider].totalTokens += (log.inputTokens || 0) + (log.outputTokens || 0);
    });
    
    // Time-based grouping (if requested)
    let timeSeriesData = null;
    if (groupBy && ['day', 'week', 'month'].includes(groupBy)) {
      timeSeriesData = groupLogsByTime(logs, groupBy);
    }
    
    res.json({
      overall: {
        totalCalls,
        successfulCalls,
        errorCalls,
        timeoutCalls,
        successRate: totalCalls > 0 ? (successfulCalls / totalCalls * 100).toFixed(2) : 0,
        totalCost: parseFloat(totalCost.toFixed(4)),
        totalInputTokens,
        totalOutputTokens,
        totalTokens,
        avgDuration: parseFloat(avgDuration.toFixed(2)),
      },
      byCallType,
      byProvider,
      ...(timeSeriesData && { timeSeries: timeSeriesData }),
      dateRange: {
        start: startDate || null,
        end: endDate || null,
      }
    });
    
  } catch (error) {
    console.error('Error fetching AI stats:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Helper function to group logs by time period
 */
function groupLogsByTime(logs, period) {
  const groups = {};
  
  logs.forEach(log => {
    let key;
    const date = new Date(log.createdAt);
    
    if (period === 'day') {
      key = date.toISOString().split('T')[0]; // YYYY-MM-DD
    } else if (period === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else if (period === 'month') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    
    if (!groups[key]) {
      groups[key] = {
        period: key,
        count: 0,
        successCount: 0,
        errorCount: 0,
        totalCost: 0,
        totalTokens: 0,
      };
    }
    
    groups[key].count++;
    if (log.status === 'SUCCESS') groups[key].successCount++;
    if (log.status === 'FAILED') groups[key].errorCount++;
    groups[key].totalCost += log.costUsd || 0;
    groups[key].totalTokens += (log.inputTokens || 0) + (log.outputTokens || 0);
  });
  
  // Convert to array and sort by period
  return Object.values(groups).sort((a, b) => a.period.localeCompare(b.period));
}

// ==================== SCRAPING & ADMIN ENDPOINTS ====================

/**
 * POST /api/scrape/catalogue-batch
 * Execute one batch of product scraping for a single retailer or all retailers
 */
app.post('/api/scrape/catalogue-batch', requireAdmin, async (req, res) => {
  try {
    const { retailer_id, cursor } = req.body;
    
    // Validate retailer_id if provided
    if (retailer_id) {
      if (typeof retailer_id !== 'string') {
        return res.status(400).json({ error: 'retailer_id must be a string' });
      }
      
      const retailer = await prisma.retailer.findUnique({
        where: { id: retailer_id }
      });
      
      if (!retailer) {
        return res.status(400).json({ error: 'Retailer not found' });
      }
      
      if (!retailer.active) {
        return res.status(400).json({ error: 'Retailer is not active' });
      }
      
      if (retailer.curatedOnly) {
        return res.status(400).json({ error: 'Retailer is curated-only and cannot be scraped' });
      }
      
      if (!retailer.websiteUrl && !retailer.giftPageUrl) {
        return res.status(400).json({ error: 'Retailer has no website URL or gift page URL' });
      }
    }
    
    // Import scraper service
    const { acquireLock, releaseLock, executeBatch } = await import('./services/scraper/scraper-service.js');
    
    // Acquire lock
    const lockResult = await acquireLock(prisma);
    if (!lockResult.success) {
      return res.status(lockResult.status || 409).json({ error: lockResult.error });
    }
    
    try {
      // Execute batch
      const batchResult = await executeBatch({
        prisma,
        retailerId: retailer_id || null,
        cursorToken: cursor || null,
        claudeApiKey: process.env.ANTHROPIC_API_KEY || null,
      });
      
      res.json(batchResult);
    } catch (error) {
      console.error('Scraper batch error:', error);
      
      // Check for cursor validation errors
      if (error.message.includes('continuation token') || error.message.includes('scope')) {
        return res.status(400).json({ error: error.message });
      }
      
      res.status(500).json({ error: error.message });
    } finally {
      // Always release lock
      await releaseLock(prisma);
    }
  } catch (error) {
    console.error('Error in scrape endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/scrape/monthly
 * Execute monthly scraping workflow: availability check + full scrape + enrichment
 */
app.post('/api/scrape/monthly', requireAdmin, async (req, res) => {
  try {
    // Import scraper service
    const { acquireLock, releaseLock, executeBatch } = await import('./services/scraper/scraper-service.js');
    
    // Acquire lock
    const lockResult = await acquireLock(prisma);
    if (!lockResult.success) {
      return res.status(lockResult.status || 409).json({ error: lockResult.error });
    }
    
    try {
      console.log('🗓️  Starting monthly scrape workflow...');
      
      // Phase A: Availability checking
      console.log('\n📋 Phase A: Checking product availability...');
      const allProducts = await prisma.product.findMany({
        where: {
          status: { not: 'INACTIVE' },
          productUrl: { not: null },
        },
        select: {
          id: true,
          productUrl: true,
          status: true,
        },
      });
      
      let checkedCount = 0;
      let inactiveCount = 0;
      
      // Check availability in batches of 50
      const { fetchWithTimeout } = await import('./utils/scrape-utils.js');
      for (let i = 0; i < allProducts.length; i += 50) {
        const batch = allProducts.slice(i, i + 50);
        
        await Promise.all(batch.map(async (product) => {
          try {
            const res = await fetchWithTimeout(product.productUrl, { method: 'HEAD' }, 5000);
            checkedCount++;
            
            // If HEAD request fails or returns 404/410, mark as inactive
            if (!res.ok && (res.status === 404 || res.status === 410)) {
              await prisma.product.update({
                where: { id: product.id },
                data: { status: 'INACTIVE' },
              });
              inactiveCount++;
            }
          } catch (error) {
            // Network errors - leave product as is
            checkedCount++;
          }
        }));
      }
      
      console.log(`   ✅ Checked ${checkedCount} products, marked ${inactiveCount} as inactive`);
      
      // Phase B: Full catalogue scrape
      console.log('\n📦 Phase B: Running full catalogue scrape...');
      let cursor = null;
      let batchCount = 0;
      let totalNewProducts = 0;
      let totalUpdated = 0;
      
      do {
        batchCount++;
        console.log(`   Batch ${batchCount}...`);
        
        const batchResult = await executeBatch({
          prisma,
          retailerId: null,
          cursorToken: cursor,
          claudeApiKey: process.env.ANTHROPIC_API_KEY || null,
        });
        
        totalNewProducts += batchResult.batch.new_products;
        totalUpdated += batchResult.batch.updated;
        cursor = batchResult.cursor;
        
        console.log(`   New: ${batchResult.batch.new_products}, Updated: ${batchResult.batch.updated}`);
      } while (cursor);
      
      console.log(`   ✅ Scrape complete: ${totalNewProducts} new, ${totalUpdated} updated`);
      
      // Phase C: Enrichment (optional - skip for now)
      console.log('\n🎨 Phase C: Enrichment (skipped - not implemented yet)');
      
      console.log('\n✅ Monthly scrape workflow complete!\n');
      
      res.json({
        success: true,
        checkedCount,
        inactiveCount,
        newProductsCount: totalNewProducts,
        updatedCount: totalUpdated,
        batchCount,
      });
    } catch (error) {
      console.error('Monthly scrape error:', error);
      res.status(500).json({ error: error.message });
    } finally {
      // Always release lock
      await releaseLock(prisma);
    }
  } catch (error) {
    console.error('Error in monthly scrape endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== ENRICHMENT ENDPOINTS ====================

/**
 * POST /api/products/import-curated
 * Import curated products from uploaded CSV/XLSX files
 * Processes in batches with cursor-based pagination
 */
app.post('/api/products/import-curated', requireAdmin, async (req, res) => {
  console.log('📥 Import request received');
  console.log('   Body:', JSON.stringify(req.body, null, 2));
  
  try {
    const {
      file_url,
      start_row = 2,
      batch_size = 40,
      expected_total = 0,
    } = req.body;
    
    if (!file_url) {
      console.error('❌ No file_url provided');
      return res.status(400).json({ 
        error: 'file_url is required. Upload a file first using /api/upload-file' 
      });
    }
    
    console.log(`📥 Starting curated import batch`);
    console.log(`   File URL: ${file_url}`);
    console.log(`   Start row: ${start_row}`);
    console.log(`   Batch size: ${batch_size}`);
    console.log(`   Expected total: ${expected_total}`);
    
    // Import the service
    const { importCuratedBatch } = await import('./services/products/import-curated.js');
    
    // Execute import
    const result = await importCuratedBatch(prisma, {
      fileUrl: file_url,
      startRow: Number(start_row),
      batchSize: Math.max(1, Math.min(50, Number(batch_size))),
      expectedTotal: Number(expected_total) || 0,
    });
    
    console.log(`✅ Import batch complete`);
    console.log(`   Result:`, JSON.stringify(result, null, 2));
    
    // Ensure we're returning the expected format
    const response = {
      done: Boolean(result.done),
      next_row: Number(result.next_row),
      processed: Number(result.processed),
      extracted_total: result.extracted_total,
      created_active: result.created_active || 0,
      created_needs_review: result.created_needs_review || 0,
      updated_existing: result.updated_existing || 0,
      matched_existing: result.matched_existing || 0,
      fields_filled: result.fields_filled || 0,
      created_retailers: result.created_retailers || [],
      unknown_categories: result.unknown_categories || [],
      unknown_genders: result.unknown_genders || [],
      skipped: result.skipped || [],
    };
    
    console.log(`   Sending response with done=${response.done}, next_row=${response.next_row}`);
    
    res.json(response);
  } catch (error) {
    console.error('❌ Error in curated import:', error.message);
    console.error('   Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Import failed',
      found_headers: error.foundHeaders || undefined,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * POST /api/products/enrich-batch
 * Enrich a batch of products with tags, descriptions, quality scores, and AI classification
 */
app.post('/api/products/enrich-batch', requireAdmin, async (req, res) => {
  try {
    const { 
      batch_size = 25, 
      retailer_id = null,
      classify = false,  // AI classification disabled by default (to save costs)
      dry_run = false,
    } = req.body;
    
    // Validate batch size
    const batchSize = Math.max(1, Math.min(40, Number(batch_size)));
    
    // Validate retailer_id if provided
    let retailerId = null;
    if (retailer_id && typeof retailer_id === 'string' && retailer_id.trim()) {
      retailerId = retailer_id.trim();
      
      const retailer = await prisma.retailer.findUnique({
        where: { id: retailerId }
      });
      
      if (!retailer) {
        return res.status(400).json({ error: 'Retailer not found' });
      }
    }

    // Get Claude API key (only if classification is enabled)
    const apiKey = classify ? process.env.ANTHROPIC_API_KEY : null;
    if (classify && !apiKey) {
      console.warn('⚠️  AI classification requested but ANTHROPIC_API_KEY not configured');
      return res.status(500).json({ 
        error: 'ANTHROPIC_API_KEY not configured',
        message: 'Please add ANTHROPIC_API_KEY to your .env file to enable AI classification',
      });
    }
    
    console.log(`🎨 Starting enrichment batch (size: ${batchSize}, retailer: ${retailerId || 'all'}, classify: ${classify}, dry_run: ${dry_run})`);
    
    // Import enrichment service
    const { enrichProductBatch } = await import('./services/enrichment/enrichment-service.js');
    
    // Execute enrichment
    const result = await enrichProductBatch(prisma, {
      batchSize,
      retailerId,
      classify,
      dryRun: dry_run,
      apiKey,
    });
    
    console.log(`✅ Enriched ${result.processed} products, ${result.remaining} remaining`);
    if (result.classified > 0) {
      console.log(`   🤖 Classified ${result.classified} products`);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error in enrichment endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== EMAIL ENDPOINTS ====================

// Send test email
app.post('/api/email/test', async (req, res) => {
  try {
    const { to, subject, message } = req.body;
    
    if (!to || !subject) {
      return res.status(400).json({ error: 'to and subject are required' });
    }

    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Test Email</h2>
        <p>${message || 'This is a test email from You Remembered By Gem.'}</p>
      </div>
    `;

    const result = await sendEmail({ to, subject, html });
    
    if (result.success) {
      res.json({ success: true, message: 'Email sent successfully', id: result.id });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send welcome email
app.post('/api/email/welcome', async (req, res) => {
  try {
    const { email, name, subscriberId } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const result = await sendWelcomeEmail(email, name, subscriberId);
    
    if (result.success) {
      res.json({ success: true, message: 'Welcome email sent', id: result.id });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error sending welcome email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send gift list approval email
app.post('/api/email/approval', async (req, res) => {
  try {
    const { email, name, recipientName, giftCount, subscriberId, recipientId, giftListId } = req.body;
    
    if (!email || !recipientName) {
      return res.status(400).json({ error: 'email and recipientName are required' });
    }

    const result = await sendApprovalEmail(email, name, recipientName, giftCount || 5, subscriberId, recipientId, giftListId);
    
    if (result.success) {
      res.json({ success: true, message: 'Approval email sent', id: result.id });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error sending approval email:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send birthday reminder email
app.post('/api/email/birthday-reminder', async (req, res) => {
  try {
    const { email, name, recipientName, daysUntil, subscriberId, recipientId } = req.body;
    
    if (!email || !recipientName) {
      return res.status(400).json({ error: 'email and recipientName are required' });
    }

    const result = await sendBirthdayReminder(email, name, recipientName, daysUntil || 7, subscriberId, recipientId);
    
    if (result.success) {
      res.json({ success: true, message: 'Birthday reminder sent', id: result.id });
    } else {
      res.status(500).json({ error: result.error });
    }
  } catch (error) {
    console.error('Error sending birthday reminder:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== FILE UPLOAD ====================

// Configure multer for file uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * Upload a file
 * POST /api/upload-file
 * 
 * Used by CuratedImportPanel to upload XLSX/CSV files for product import
 */
app.post('/api/upload-file', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return the file path so it can be used in importCuratedProducts function
    const file_url = path.resolve(req.file.path);
    
    res.json({ file_url });
  } catch (error) {
    console.error('❌ File upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== FORENSIC AUDIT ====================

/**
 * Run forensic audit
 * POST /api/audit/forensic
 * 
 * Body: { write_sheet: boolean } (optional)
 * 
 * Returns comprehensive catalogue health analysis:
 * - Product classification (healthy, correctly_rejected, needs_manual_review, needs_re_enrichment)
 * - Retailer coverage grading
 * - Summary statistics
 * - Sample examples
 */
app.post('/api/audit/forensic', async (req, res) => {
  try {
    console.log('🔍 Running forensic audit...');
    
    const auditResults = await runForensicAudit(prisma);
    
    console.log(`✅ Forensic audit complete: ${auditResults.totals.products} products analyzed in ${auditResults.executionTimeMs}ms`);
    
    res.json(auditResults);
  } catch (error) {
    console.error('❌ Forensic audit error:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({ 
      error: error.message,
      details: error.stack,
    });
  }
});

// ==================== GLOBAL OCCASION DATES (ADMIN) ====================

/**
 * GET /api/admin/occasion-dates
 * 
 * Get all global occasion dates (admin only)
 * Returns occasions sorted by type and year
 */
app.get('/api/admin/occasion-dates', async (req, res) => {
  try {
    const dates = await prisma.globalOccasionDate.findMany({
      orderBy: [
        { occasionType: 'asc' },
        { year: 'asc' }
      ]
    });
    res.json(dates);
  } catch (error) {
    console.error('Error fetching occasion dates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/occasion-dates
 * 
 * Create or update a global occasion date (admin only)
 * Body: { occasionType, year, month, day, notes }
 */
app.post('/api/admin/occasion-dates', async (req, res) => {
  try {
    const { occasionType, year, month, day, notes } = req.body;
    
    if (!occasionType || !year || !month || !day) {
      return res.status(400).json({ 
        error: 'Missing required fields: occasionType, year, month, day' 
      });
    }
    
    // Validate month and day
    if (month < 1 || month > 12) {
      return res.status(400).json({ error: 'Month must be between 1 and 12' });
    }
    if (day < 1 || day > 31) {
      return res.status(400).json({ error: 'Day must be between 1 and 31' });
    }
    
    const date = await prisma.globalOccasionDate.upsert({
      where: {
        occasionType_year: {
          occasionType,
          year: parseInt(year)
        }
      },
      create: {
        occasionType,
        year: parseInt(year),
        month: parseInt(month),
        day: parseInt(day),
        notes: notes || null
      },
      update: {
        month: parseInt(month),
        day: parseInt(day),
        notes: notes || null
      }
    });
    
    res.json(date);
  } catch (error) {
    console.error('Error saving occasion date:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/occasion-dates/:id
 * 
 * Delete a global occasion date (admin only)
 */
app.delete('/api/admin/occasion-dates/:id', async (req, res) => {
  try {
    await prisma.globalOccasionDate.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting occasion date:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==================== OCCASION CHECK (TESTING) ====================

/**
 * POST /api/admin/run-occasion-check
 * 
 * Manually run the occasion check (for testing Phase 2)
 * Checks all recipients for upcoming occasions and sends appropriate emails
 * 
 * This is a TESTING endpoint - will be replaced by scheduled cron job in production
 */
app.post('/api/admin/run-occasion-check', async (req, res) => {
  try {
    const {
      getAllRecipientOccasions,
      daysUntil,
      daysSince,
      hasEmailBeenSent,
      logEmailSend
    } = await import('./utils/occasion-resolver.js');
    
    console.log('\n🔍 Starting occasion check...\n');
    
    // Get all recipients
    const recipients = await prisma.recipient.findMany({
      include: {
        subscriber: true
      }
    });
    
    const currentYear = new Date().getFullYear();
    const results = [];
    let emailsSent = 0;
    
    for (const recipient of recipients) {
      if (!recipient.subscriber?.email) {
        console.log(`⏭️  Skipping ${recipient.name} - no subscriber email`);
        continue;
      }
      
      // Get all occasions for this recipient
      const occasions = await getAllRecipientOccasions(recipient, currentYear);
      
      console.log(`\n👤 ${recipient.name} - ${occasions.length} occasion(s)`);
      
      for (const occasion of occasions) {
        const until = daysUntil(occasion.date);
        const since = daysSince(occasion.date);
        const occasionLabel = occasion.customLabel || occasion.type;
        
        console.log(`   📅 ${occasionLabel}: ${occasion.date.toDateString()} (${until} days)`);
        
        // 6-week reminder (42 days before)
        if (until === 42) {
          const alreadySent = await hasEmailBeenSent(
            recipient.id,
            occasion.type,
            'SIX_WEEK_REMINDER',
            currentYear
          );
          
          if (!alreadySent) {
            console.log(`      ✉️  Sending 6-week reminder...`);
            
            // TODO: Send actual email via Resend
            // For now, just log it
            
            await logEmailSend({
              subscriberId: recipient.subscriberId,
              recipientId: recipient.id,
              emailType: 'SIX_WEEK_REMINDER',
              occasionType: occasion.type,
              occasionYear: currentYear,
              occasionDate: occasion.date,
              status: 'SENT'
            });
            
            emailsSent++;
            results.push({
              recipient: recipient.name,
              occasion: occasionLabel,
              type: '6_week_reminder',
              status: 'sent'
            });
          } else {
            console.log(`      ⏭️  6-week reminder already sent`);
          }
        }
        
        // 2-week reminder (14 days before)
        if (until === 14) {
          const alreadySent = await hasEmailBeenSent(
            recipient.id,
            occasion.type,
            'FOURTEEN_DAY',
            currentYear
          );
          
          if (!alreadySent) {
            console.log(`      ✉️  Sending 2-week reminder...`);
            
            await logEmailSend({
              subscriberId: recipient.subscriberId,
              recipientId: recipient.id,
              emailType: 'FOURTEEN_DAY',
              occasionType: occasion.type,
              occasionYear: currentYear,
              occasionDate: occasion.date,
              status: 'SENT'
            });
            
            emailsSent++;
            results.push({
              recipient: recipient.name,
              occasion: occasionLabel,
              type: '2_week_reminder',
              status: 'sent'
            });
          } else {
            console.log(`      ⏭️  2-week reminder already sent`);
          }
        }
        
        // Post-occasion follow-up (2 days after)
        if (since === 2) {
          const alreadySent = await hasEmailBeenSent(
            recipient.id,
            occasion.type,
            'POST_OCCASION',
            currentYear
          );
          
          if (!alreadySent) {
            console.log(`      ✉️  Sending post-occasion follow-up...`);
            
            await logEmailSend({
              subscriberId: recipient.subscriberId,
              recipientId: recipient.id,
              emailType: 'POST_OCCASION',
              occasionType: occasion.type,
              occasionYear: currentYear,
              occasionDate: occasion.date,
              status: 'SENT'
            });
            
            emailsSent++;
            results.push({
              recipient: recipient.name,
              occasion: occasionLabel,
              type: 'post_occasion',
              status: 'sent'
            });
          } else {
            console.log(`      ⏭️  Post-occasion follow-up already sent`);
          }
        }
        
        // Immediate generation (< 42 days away, no list yet)
        if (until > 0 && until < 42) {
          // Check if gift list already generated for this occasion
          const existingList = await prisma.giftList.findFirst({
            where: {
              recipientId: recipient.id,
              birthdayDate: occasion.date
            }
          });
          
          if (!existingList) {
            console.log(`      🎁 IMMEDIATE GENERATION NEEDED (${until} days away)`);
            results.push({
              recipient: recipient.name,
              occasion: occasionLabel,
              type: 'needs_generation',
              daysUntil: until
            });
          }
        }
      }
    }
    
    console.log(`\n✅ Occasion check complete:`);
    console.log(`   Recipients scanned: ${recipients.length}`);
    console.log(`   Emails sent: ${emailsSent}\n`);
    
    res.json({
      scanned: recipients.length,
      emailsSent: emailsSent,
      results: results
    });
    
  } catch (error) {
    console.error('❌ Error running occasion check:', error);
    console.error(error.stack);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 API Server running on http://localhost:${PORT}`);
  console.log(`📊 Database: PostgreSQL via Prisma`);
  console.log(`🔧 Environment: ${NODE_ENV}`);
  console.log(`🔧 Available endpoints:`);
  console.log(`   - GET  /api/health`);
  console.log(`   - GET  /api/users`);
  console.log(`   - PATCH /api/users/:id`);
  console.log(`   - GET  /api/retailers`);
  console.log(`   - POST /api/retailers`);
  console.log(`   - PATCH /api/retailers/:id`);
  console.log(`   - GET  /api/subscribers`);
  console.log(`   - POST /api/subscribers`);
  console.log(`   - GET  /api/recipients`);
  console.log(`   - POST /api/recipients`);
  console.log(`   - GET  /api/gift-lists`);
  console.log(`   - PATCH /api/gift-lists/:id`);
  console.log(`   - GET  /api/gift-items`);
  console.log(`   - PATCH /api/gift-items/:id`);
  console.log(`   - POST /api/generate-gift-list`);
  console.log(`   - GET  /api/products`);
  console.log(`   - POST /api/scrape/catalogue-batch (admin)`);
  console.log(`   - POST /api/scrape/monthly (admin)`);
  console.log(`   - POST /api/products/enrich-batch (admin)`);
  console.log(`   - POST /api/email/test`);
  console.log(`   - POST /api/email/welcome`);
  console.log(`   - POST /api/email/approval`);
  console.log(`   - POST /api/email/birthday-reminder`);
  console.log(`   - POST /api/audit/forensic (admin)`);
  console.log(`   - GET  /api/admin/ai-logs (admin)`);
  console.log(`   - GET  /api/admin/ai-stats (admin)`);
  console.log(`\n✨ Ready to serve data from your PostgreSQL database!\n`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

