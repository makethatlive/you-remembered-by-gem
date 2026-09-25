/**
 * Occasion Resolver Utility
 * 
 * Determines the actual date for any occasion based on:
 * - Personal occasions (Birthday, Anniversary, Other) - use recipient data
 * - Global occasions (Christmas, Eid, Diwali, etc.) - lookup from database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Occasions that are stored per-recipient (not in global table)
const PERSONAL_OCCASIONS = ['Birthday', 'Anniversary', 'Other'];

// Fixed occasions that don't need database lookup (same every year)
const FIXED_OCCASIONS = {
  'Christmas': { month: 12, day: 25 },
  "Valentine's Day": { month: 2, day: 14 }
};

/**
 * Resolve the date for a specific occasion
 * @param {Object} occasion - Occasion object from recipient.occasions array
 * @param {string} occasion.type - Occasion type (Birthday, Eid, Christmas, etc.)
 * @param {number} occasion.day - Day (for personal occasions)
 * @param {number} occasion.month - Month (for personal occasions)
 * @param {number} year - Target year
 * @returns {Promise<Date|null>} The resolved date, or null if not found
 */
export async function resolveOccasionDate(occasion, year) {
  const { type, day, month, date } = occasion;
  
  // Personal occasions with explicit date string (for "Other" custom occasions)
  if (PERSONAL_OCCASIONS.includes(type) && date) {
    const d = new Date(date);
    // Use the month/day from the provided date but with target year
    return new Date(year, d.getMonth(), d.getDate());
  }
  
  // Personal occasions: use recipient's stored date
  if (PERSONAL_OCCASIONS.includes(type)) {
    if (!day || !month) {
      console.warn(`Missing day/month for personal occasion: ${type}`);
      return null;
    }
    return new Date(year, month - 1, day);
  }
  
  // Fixed calendar occasions
  if (FIXED_OCCASIONS[type]) {
    const { month: m, day: d } = FIXED_OCCASIONS[type];
    return new Date(year, m - 1, d);
  }
  
  // Variable occasions: lookup in global_occasion_dates
  try {
    const globalDate = await prisma.globalOccasionDate.findUnique({
      where: {
        occasionType_year: {
          occasionType: type,
          year: parseInt(year)
        }
      }
    });
    
    if (globalDate) {
      return new Date(year, globalDate.month - 1, globalDate.day);
    }
    
    console.warn(`No global date configured for ${type} in ${year}`);
    return null;
  } catch (error) {
    console.error(`Error looking up global occasion date for ${type} ${year}:`, error);
    return null;
  }
}

/**
 * Get all resolved occasions for a recipient
 * @param {Object} recipient - Recipient record with occasions field
 * @param {number} year - Target year
 * @returns {Promise<Array>} Array of {type, date, budgetMin, budgetMax}
 */
export async function getAllRecipientOccasions(recipient, year) {
  const occasions = [];
  
  // Parse occasions from recipient
  const recipientOccasions = recipient.occasions || [];
  
  for (const occ of recipientOccasions) {
    const date = await resolveOccasionDate(occ, year);
    if (date) {
      occasions.push({
        type: occ.type,
        date: date,
        budgetMin: occ.budget_min || recipient.budgetMin || recipient.budget_min,
        budgetMax: occ.budget_max || recipient.budgetMax || recipient.budget_max,
        customLabel: occ.custom_label
      });
    }
  }
  
  return occasions.sort((a, b) => a.date - b.date);
}

/**
 * Calculate days until a specific date
 * @param {Date} targetDate - Future date
 * @returns {number} Days until target (negative if past)
 */
export function daysUntil(targetDate) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = targetDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days since a specific date
 * @param {Date} targetDate - Past date
 * @returns {number} Days since target (negative if future)
 */
export function daysSince(targetDate) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = today.getTime() - targetDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if an email has already been sent for this occasion
 * @param {string} recipientId - Recipient ID
 * @param {string} occasionType - Occasion type
 * @param {string} emailType - Email type (6_week_reminder, 2_week_reminder, etc.)
 * @param {number} year - Occasion year
 * @returns {Promise<boolean>} True if already sent
 */
export async function hasEmailBeenSent(recipientId, occasionType, emailType, year) {
  try {
    const log = await prisma.emailLog.findFirst({
      where: {
        recipientId: recipientId,
        occasionType: occasionType,
        emailType: emailType.toUpperCase(),
        occasionYear: year
      }
    });
    return !!log;
  } catch (error) {
    console.error('Error checking email log:', error);
    return false; // Fail open - allow sending if check fails
  }
}

/**
 * Log an email send
 * @param {Object} data - Email log data
 */
export async function logEmailSend(data) {
  try {
    await prisma.emailLog.create({
      data: {
        subscriberId: data.subscriberId,
        recipientId: data.recipientId,
        giftListId: data.giftListId || null,
        emailType: data.emailType.toUpperCase(),
        occasionType: data.occasionType,
        occasionYear: data.occasionYear,
        occasionDate: data.occasionDate,
        status: data.status || 'SENT'
      }
    });
  } catch (error) {
    console.error('Error logging email:', error);
    // Don't throw - email was already sent, logging failure shouldn't break flow
  }
}

export default {
  resolveOccasionDate,
  getAllRecipientOccasions,
  daysUntil,
  daysSince,
  hasEmailBeenSent,
  logEmailSend
};
