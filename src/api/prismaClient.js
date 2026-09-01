/**
 * Replacement for Base44 SDK
 * Provides similar API interface using Prisma
 */

import prisma from '../lib/db.js';

class PrismaAPIClient {
  constructor() {
    this.prisma = prisma;
  }

  /**
   * Generic query builder similar to Base44 SDK
   */
  async query(entityName, options = {}) {
    const { where, include, orderBy, take, skip, select } = options;
    
    const model = this.getModel(entityName);
    
    return await model.findMany({
      where,
      include,
      orderBy,
      take,
      skip,
      select,
    });
  }

  /**
   * Get a single record by ID
   */
  async get(entityName, id, options = {}) {
    const model = this.getModel(entityName);
    
    return await model.findUnique({
      where: { id },
      include: options.include,
      select: options.select,
    });
  }

  /**
   * Create a new record
   */
  async create(entityName, data) {
    const model = this.getModel(entityName);
    
    return await model.create({
      data,
    });
  }

  /**
   * Update an existing record
   */
  async update(entityName, id, data) {
    const model = this.getModel(entityName);
    
    return await model.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a record
   */
  async delete(entityName, id) {
    const model = this.getModel(entityName);
    
    return await model.delete({
      where: { id },
    });
  }

  /**
   * Count records
   */
  async count(entityName, where = {}) {
    const model = this.getModel(entityName);
    
    return await model.count({
      where,
    });
  }

  /**
   * Batch operations
   */
  async createMany(entityName, data) {
    const model = this.getModel(entityName);
    
    return await model.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async updateMany(entityName, where, data) {
    const model = this.getModel(entityName);
    
    return await model.updateMany({
      where,
      data,
    });
  }

  async deleteMany(entityName, where) {
    const model = this.getModel(entityName);
    
    return await model.deleteMany({
      where,
    });
  }

  /**
   * Raw query execution
   */
  async raw(query, params = []) {
    return await this.prisma.$queryRawUnsafe(query, ...params);
  }

  /**
   * Transaction support
   */
  async transaction(operations) {
    return await this.prisma.$transaction(operations);
  }

  /**
   * Get Prisma model by entity name
   */
  getModel(entityName) {
    const modelMap = {
      User: this.prisma.user,
      Subscriber: this.prisma.subscriber,
      Recipient: this.prisma.recipient,
      Retailer: this.prisma.retailer,
      Product: this.prisma.product,
      GiftList: this.prisma.giftList,
      GiftItem: this.prisma.giftItem,
      EmailLog: this.prisma.emailLog,
      SignupAttempt: this.prisma.signupAttempt,
      ScrapeRunLog: this.prisma.scrapeRunLog,
      ScrapeState: this.prisma.scrapeState,
      TrendStats: this.prisma.trendStats,
    };

    const model = modelMap[entityName];
    if (!model) {
      throw new Error(`Unknown entity: ${entityName}`);
    }

    return model;
  }

  /**
   * Direct access to Prisma client for complex queries
   */
  get client() {
    return this.prisma;
  }
}

// Export singleton instance
export const db = new PrismaAPIClient();
export default db;
