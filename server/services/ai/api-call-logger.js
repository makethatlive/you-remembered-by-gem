/**
 * AI API Call Logger Service
 * 
 * Tracks all AI API calls for monitoring, debugging, and cost tracking.
 */

export default class APICallLogger {
  constructor(prisma) {
    this.prisma = prisma;
  }

  /**
   * Calculate cost based on token usage
   * @param {string} provider - "claude" or "gemini"
   * @param {number} inputTokens - Input tokens used
   * @param {number} outputTokens - Output tokens used
   * @returns {number} Cost in USD
   */
  calculateCost(provider, inputTokens, outputTokens) {
    if (provider === 'claude') {
      // Claude Sonnet 4: $3/1M input, $15/1M output
      const inputCost = (inputTokens * 3) / 1000000;
      const outputCost = (outputTokens * 15) / 1000000;
      return inputCost + outputCost;
    }
    
    if (provider === 'gemini') {
      // Gemini 1.5 Pro: $1.25/1M input, $5/1M output
      const inputCost = (inputTokens * 1.25) / 1000000;
      const outputCost = (outputTokens * 5) / 1000000;
      return inputCost + outputCost;
    }
    
    return 0;
  }

  /**
   * Log an AI API call
   * @param {object} data - Call data
   * @returns {Promise<object>} Created log entry
   */
  async logCall(data) {
    try {
      const {
        callType,
        provider,
        model,
        recipientId,
        recipientName,
        giftListId,
        operation,
        inputTokens,
        outputTokens,
        durationMs,
        status = 'SUCCESS',
        errorMessage,
        requestData,
        responseData,
      } = data;

      const totalTokens = (inputTokens || 0) + (outputTokens || 0);
      const costUsd = this.calculateCost(provider, inputTokens || 0, outputTokens || 0);

      const log = await this.prisma.aIApiCallLog.create({
        data: {
          callType: callType.toUpperCase(),
          provider,
          model,
          recipientId,
          recipientName,
          giftListId,
          operation,
          inputTokens,
          outputTokens,
          totalTokens,
          costUsd,
          durationMs,
          status: status.toUpperCase(),
          errorMessage,
          requestData: requestData ? JSON.stringify(requestData) : null,
          responseData: responseData ? JSON.stringify(responseData) : null,
        },
      });

      console.log(`📊 AI Call logged: ${callType} | ${provider} | ${totalTokens} tokens | $${costUsd.toFixed(4)}`);

      return log;
    } catch (error) {
      console.error('❌ Failed to log AI call:', error.message);
      // Don't throw - logging failure shouldn't break the main flow
      return null;
    }
  }

  /**
   * Get all AI call logs with filtering
   * @param {object} filters - Filter options
   * @returns {Promise<array>} Array of logs
   */
  async getLogs(filters = {}) {
    const { 
      startDate, 
      endDate, 
      provider, 
      callType, 
      status,
      recipientId,
      giftListId,
      limit = 100 
    } = filters;

    const where = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    
    if (provider) where.provider = provider;
    if (callType) where.callType = callType.toUpperCase();
    if (status) where.status = status.toUpperCase();
    if (recipientId) where.recipientId = recipientId;
    if (giftListId) where.giftListId = giftListId;

    const logs = await this.prisma.aIApiCallLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return logs;
  }

  /**
   * Get AI call statistics
   * @param {object} filters - Filter options
   * @returns {Promise<object>} Statistics
   */
  async getStats(filters = {}) {
    const { startDate, endDate, provider } = filters;

    const where = {};
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    
    if (provider) where.provider = provider;

    const [totalCalls, successCalls, failedCalls, stats] = await Promise.all([
      this.prisma.aIApiCallLog.count({ where }),
      this.prisma.aIApiCallLog.count({ where: { ...where, status: 'SUCCESS' } }),
      this.prisma.aIApiCallLog.count({ where: { ...where, status: 'FAILED' } }),
      this.prisma.aIApiCallLog.aggregate({
        where,
        _sum: {
          inputTokens: true,
          outputTokens: true,
          totalTokens: true,
          costUsd: true,
        },
        _avg: {
          durationMs: true,
        },
      }),
    ]);

    return {
      totalCalls,
      successCalls,
      failedCalls,
      successRate: totalCalls > 0 ? ((successCalls / totalCalls) * 100).toFixed(2) : 0,
      totalInputTokens: stats._sum.inputTokens || 0,
      totalOutputTokens: stats._sum.outputTokens || 0,
      totalTokens: stats._sum.totalTokens || 0,
      totalCost: stats._sum.costUsd || 0,
      avgDuration: stats._avg.durationMs || 0,
    };
  }
}
