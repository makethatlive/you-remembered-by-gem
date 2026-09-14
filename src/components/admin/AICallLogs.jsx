import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  TrendingUp, 
  AlertCircle, 
  CheckCircle, 
  Clock,
  DollarSign,
  Zap,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';

export default function AICallLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  
  // Filter state
  const [filters, setFilters] = useState({
    status: '',
    callType: '',
    startDate: '',
    endDate: '',
  });
  
  const [showFilters, setShowFilters] = useState(false);

  // Fetch logs
  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
      });
      
      // Add filters
      if (filters.status) params.append('status', filters.status);
      if (filters.callType) params.append('callType', filters.callType);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      
      const response = await fetch(`/api/admin/ai-logs?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch AI logs');
      }
      
      const data = await response.json();
      setLogs(data.logs || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching AI logs:', err);
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch stats
  const fetchStats = async () => {
    setStatsLoading(true);
    
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      
      const response = await fetch(`/api/admin/ai-stats?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch AI stats');
      }
      
      const data = await response.json();
      setStats(data);
    } catch (err) {
      console.error('Error fetching AI stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };
  
  // Initial load
  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [page, filters]);
  
  // Handle filter changes
  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filters change
  };
  
  // Clear filters
  const clearFilters = () => {
    setFilters({
      status: '',
      callType: '',
      startDate: '',
      endDate: '',
    });
    setPage(1);
  };
  
  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    return `$${amount.toFixed(4)}`;
  };
  
  // Get status badge
  const getStatusBadge = (status) => {
    const styles = {
      SUCCESS: 'bg-green-100 text-green-800',
      ERROR: 'bg-red-100 text-red-800',
      TIMEOUT: 'bg-yellow-100 text-yellow-800',
    };
    
    const icons = {
      SUCCESS: CheckCircle,
      ERROR: AlertCircle,
      TIMEOUT: Clock,
    };
    
    const Icon = icons[status] || AlertCircle;
    const style = styles[status] || 'bg-gray-100 text-gray-800';
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${style}`}>
        <Icon className="w-3 h-3" />
        {status}
      </span>
    );
  };
  
  // Get call type label
  const getCallTypeLabel = (callType) => {
    const labels = {
      PROFILE_ANALYSIS: 'Profile Analysis',
      GIFT_SELECTION: 'Gift Selection',
      PRODUCT_CLASSIFICATION: 'Product Classification',
    };
    return labels[callType] || callType;
  };

  return (
    <div className="max-w-8xl mx-auto px-8 sm:px-12 lg:px-16 pt-6 pb-16">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-brand-dark mb-1">AI API Call Logs</h1>
          <p className="font-body text-sm text-brand-dark/50">
            Monitor AI usage, costs, and performance
          </p>
        </div>
        <button
          onClick={() => {
            fetchLogs();
            fetchStats();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-brand-teal text-white rounded-full hover:bg-brand-teal/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Statistics Dashboard */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard
            icon={Activity}
            label="Total Calls"
            value={stats.overall.totalCalls}
            subtitle={`${stats.overall.successRate}% success`}
            color="teal"
          />
          <StatCard
            icon={DollarSign}
            label="Total Cost"
            value={formatCurrency(stats.overall.totalCost)}
            subtitle="Lifetime"
            color="gold"
          />
          <StatCard
            icon={Zap}
            label="Total Tokens"
            value={stats.overall.totalTokens.toLocaleString()}
            subtitle={`Avg ${Math.round(stats.overall.avgDuration)}ms`}
            color="teal"
          />
          <StatCard
            icon={CheckCircle}
            label="Success Rate"
            value={`${stats.overall.successRate}%`}
            subtitle={`${stats.overall.errorCalls} errors`}
            color={parseFloat(stats.overall.successRate) > 95 ? 'green' : 'yellow'}
          />
        </div>
      )}

      {/* Call Type Breakdown */}
      {!statsLoading && stats && stats.byCallType && (
        <div className="bg-brand-cream-card rounded-2xl shadow-sm p-6 mb-6">
          <h2 className="font-display text-xl text-brand-dark mb-4">By Call Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(stats.byCallType).map(([type, data]) => (
              <div key={type} className="bg-white rounded-xl p-4 border border-brand-gold-soft/20">
                <h3 className="font-body font-semibold text-brand-dark mb-2">
                  {getCallTypeLabel(type)}
                </h3>
                <div className="space-y-1 text-sm text-brand-dark/70">
                  <div className="flex justify-between">
                    <span>Calls:</span>
                    <span className="font-medium">{data.count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success:</span>
                    <span className="font-medium text-green-600">{data.successCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Errors:</span>
                    <span className="font-medium text-red-600">{data.errorCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Cost:</span>
                    <span className="font-medium">{formatCurrency(data.totalCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Duration:</span>
                    <span className="font-medium">{Math.round(data.avgDuration)}ms</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-brand-cream-card rounded-2xl shadow-sm p-4 mb-6">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 font-body font-medium text-brand-dark hover:text-brand-teal transition-colors"
        >
          <Filter className="w-4 h-4" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
        
        {showFilters && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Status</label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-brand-gold-soft/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal"
              >
                <option value="">All</option>
                <option value="SUCCESS">Success</option>
                <option value="ERROR">Error</option>
                <option value="TIMEOUT">Timeout</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Call Type</label>
              <select
                value={filters.callType}
                onChange={(e) => handleFilterChange('callType', e.target.value)}
                className="w-full px-3 py-2 border border-brand-gold-soft/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal"
              >
                <option value="">All</option>
                <option value="PROFILE_ANALYSIS">Profile Analysis</option>
                <option value="GIFT_SELECTION">Gift Selection</option>
                <option value="PRODUCT_CLASSIFICATION">Product Classification</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-brand-gold-soft/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-dark mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-brand-gold-soft/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-teal"
              />
            </div>
            
            <div className="md:col-span-4">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm font-medium text-brand-teal hover:text-brand-teal/80 transition-colors"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Logs Table */}
      <div className="bg-brand-cream-card rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-brand-teal animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-red-600">
              <AlertCircle className="w-8 h-8 mb-2" />
              <p className="font-medium">{error}</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-brand-dark/50">
              <Activity className="w-8 h-8 mb-2" />
              <p className="font-medium">No AI calls found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-brand-gold-soft/10 border-b border-brand-gold-soft/20">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-brand-dark uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-brand-dark uppercase tracking-wider">
                      Call Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-brand-dark uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-brand-dark uppercase tracking-wider">
                      Recipient
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-brand-dark uppercase tracking-wider">
                      Tokens
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-brand-dark uppercase tracking-wider">
                      Cost
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-brand-dark uppercase tracking-wider">
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-brand-gold-soft/10">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-brand-gold-soft/5 transition-colors">
                      <td className="px-4 py-3 text-sm text-brand-dark whitespace-nowrap">
                        {formatDate(log.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-brand-dark">
                        <span className="font-medium">{getCallTypeLabel(log.callType)}</span>
                        <br />
                        <span className="text-xs text-brand-dark/50">
                          {log.provider} / {log.model}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getStatusBadge(log.status)}
                      </td>
                      <td className="px-4 py-3 text-sm text-brand-dark">
                        {log.recipient ? (
                          <span className="font-medium">{log.recipient.name}</span>
                        ) : (
                          <span className="text-brand-dark/30">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-brand-dark text-right">
                        <span className="font-mono">
                          {(log.inputTokens || 0).toLocaleString()} / {(log.outputTokens || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-brand-dark text-right font-mono">
                        {log.cost ? formatCurrency(log.cost) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-brand-dark text-right font-mono">
                        {log.duration ? `${log.duration}ms` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="bg-brand-gold-soft/5 px-4 py-3 flex items-center justify-between border-t border-brand-gold-soft/20">
                  <div className="text-sm text-brand-dark/70">
                    Page {pagination.page} of {pagination.totalPages} ({pagination.total} total calls)
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(page - 1)}
                      disabled={!pagination.hasPrev}
                      className="px-3 py-1 bg-white border border-brand-gold-soft/30 rounded-lg text-sm font-medium text-brand-dark hover:bg-brand-gold-soft/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={!pagination.hasNext}
                      className="px-3 py-1 bg-white border border-brand-gold-soft/30 rounded-lg text-sm font-medium text-brand-dark hover:bg-brand-gold-soft/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ icon: Icon, label, value, subtitle, color = 'teal' }) {
  const colorStyles = {
    teal: 'bg-brand-teal/10 text-brand-teal',
    gold: 'bg-brand-gold/10 text-brand-gold',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
  };
  
  return (
    <div className="bg-brand-cream-card rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorStyles[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="font-body text-sm text-brand-dark/70">{label}</span>
      </div>
      <div className="font-display text-2xl text-brand-dark font-semibold mb-1">{value}</div>
      {subtitle && (
        <div className="font-body text-xs text-brand-dark/50">{subtitle}</div>
      )}
    </div>
  );
}
