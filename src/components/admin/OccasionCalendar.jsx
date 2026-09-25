import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Trash2, Plus, Calendar, Save, AlertCircle } from 'lucide-react';
import { ADDITIONAL_OCCASION_OPTIONS } from '@/components/onboarding/options';

const VARIABLE_OCCASIONS = [
  'Christmas',
  "Mother's Day",
  "Father's Day",
  'Easter',
  'Eid',
  'Diwali',
  'Hanukkah',
  'Rosh Hashanah',
  'Lunar New Year'
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = [CURRENT_YEAR, CURRENT_YEAR + 1, CURRENT_YEAR + 2];

export default function OccasionCalendar() {
  const [occasions, setOccasions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false); // NEW: For test button
  const [editingId, setEditingId] = useState(null);
  const [expandedOccasions, setExpandedOccasions] = useState(new Set()); // Track which occasions are expanded
  const [newOccasion, setNewOccasion] = useState({
    occasionType: '',
    year: CURRENT_YEAR,
    month: 1,
    day: 1,
    notes: ''
  });

  useEffect(() => {
    loadOccasions();
  }, []);

  const loadOccasions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/occasion-dates');
      if (!response.ok) throw new Error('Failed to load occasions');
      const data = await response.json();
      setOccasions(data);
    } catch (error) {
      console.error('Error loading occasions:', error);
      toast({
        title: 'Error',
        description: 'Failed to load occasion dates',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (occasion) => {
    try {
      setSaving(true);
      const response = await fetch('/api/admin/occasion-dates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(occasion)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save');
      }

      toast({
        title: 'Success',
        description: `${occasion.occasionType} ${occasion.year} saved successfully`
      });

      setEditingId(null);
      setNewOccasion({
        occasionType: '',
        year: CURRENT_YEAR,
        month: 1,
        day: 1,
        notes: ''
      });
      
      await loadOccasions();
    } catch (error) {
      console.error('Error saving occasion:', error);
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this occasion date?')) return;

    try {
      const response = await fetch(`/api/admin/occasion-dates/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete');

      toast({
        title: 'Deleted',
        description: 'Occasion date removed'
      });

      await loadOccasions();
    } catch (error) {
      console.error('Error deleting occasion:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete occasion date',
        variant: 'destructive'
      });
    }
  };

  const handleUpdate = async (id, updates) => {
    const occasion = occasions.find(o => o.id === id);
    await handleSave({ ...occasion, ...updates });
  };

  const groupedOccasions = occasions.reduce((acc, occ) => {
    if (!acc[occ.occasionType]) acc[occ.occasionType] = [];
    acc[occ.occasionType].push(occ);
    return acc;
  }, {});

  const toggleExpand = (occasionType) => {
    setExpandedOccasions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(occasionType)) {
        newSet.delete(occasionType);
      } else {
        newSet.add(occasionType);
      }
      return newSet;
    });
  };

  const isExpanded = (occasionType) => expandedOccasions.has(occasionType);

  const handleTestOccasionCheck = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/admin/run-occasion-check', {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Test failed');
      }

      const data = await response.json();
      
      toast({
        title: 'Occasion Check Complete',
        description: `Scanned ${data.scanned} recipients, sent ${data.emailsSent} emails. Check console for details.`
      });
      
      console.log('📊 Occasion Check Results:', data);
    } catch (error) {
      console.error('Test error:', error);
      toast({
        title: 'Test Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Calendar className="w-12 h-12 text-brand-teal mx-auto mb-4 animate-pulse" />
          <p className="text-brand-dark/60">Loading occasion calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-8xl mx-auto px-8 sm:px-12 lg:px-16 pt-6 pb-16">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-brand-dark mb-1">Occasion Calendar</h1>
          <p className="font-body text-sm text-brand-dark/50">
            Manage dates for variable occasions (Eid, Diwali, Lunar New Year, etc.)
          </p>
        </div>
        <Button
          onClick={handleTestOccasionCheck}
          disabled={testing}
          className="bg-brand-gold hover:bg-brand-gold/90 text-brand-dark font-body font-semibold"
        >
          {testing ? (
            <>
              <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Testing...
            </>
          ) : (
            '🧪 Test Occasion Check'
          )}
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-brand-gold/20 bg-brand-cream-card mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-brand-teal flex-shrink-0 mt-0.5" />
            <div className="text-sm text-brand-dark/70">
              <p className="font-semibold mb-1">Variable occasions require annual updates</p>
              <p>
                Occasions like Eid, Diwali, and Lunar New Year change dates each year. 
                Add dates for the current year and upcoming years so gift lists can be 
                generated at the correct time.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Existing Occasions */}
      <div className="mb-8">
        <h2 className="font-display text-xl text-brand-dark mb-4">Configured Occasions</h2>
        
        {Object.keys(groupedOccasions).length === 0 ? (
          <Card className="border-brand-gold/20">
            <CardContent className="text-center py-16">
              <Calendar className="w-16 h-16 text-brand-dark/20 mx-auto mb-4" />
              <p className="text-brand-dark/60 font-body">No occasion dates configured yet</p>
              <p className="text-brand-dark/40 text-sm mt-1">Add your first occasion below</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {Object.entries(groupedOccasions).map(([occasionType, dates]) => {
              const sortedDates = dates.sort((a, b) => a.year - b.year);
              const currentYearDate = sortedDates.find(d => d.year === CURRENT_YEAR);
              const expanded = isExpanded(occasionType);
              const visibleDates = expanded ? sortedDates : (currentYearDate ? [currentYearDate] : [sortedDates[0]]);
              const hasMore = sortedDates.length > 1;

              return (
                <Card key={occasionType} className="border-brand-gold/20 bg-white">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="font-display text-lg text-brand-dark">
                        {occasionType}
                        <span className="ml-2 text-sm font-body font-normal text-brand-dark/50">
                          ({sortedDates.length} {sortedDates.length === 1 ? 'year' : 'years'})
                        </span>
                      </CardTitle>
                      {hasMore && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpand(occasionType)}
                          className="text-brand-teal hover:text-brand-teal/80 hover:bg-brand-teal/10"
                        >
                          {expanded ? (
                            <>
                              <span className="text-sm font-body mr-1">Show less</span>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-body mr-1">Show all years</span>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {visibleDates.map((occ) => (
                        <div
                          key={occ.id}
                          className="flex items-center justify-between p-4 bg-brand-cream-card/50 rounded-xl border border-brand-gold/10 hover:border-brand-gold/30 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-4">
                              <span className="font-body font-semibold text-brand-dark min-w-[60px]">
                                {occ.year}
                                {occ.year === CURRENT_YEAR && (
                                  <span className="ml-2 text-xs font-normal text-brand-teal">Current</span>
                                )}
                              </span>
                              <span className="font-body text-brand-dark/70">
                                {MONTHS[occ.month - 1]} {occ.day}
                              </span>
                              {occ.notes && (
                                <span className="text-sm text-brand-dark/50 italic font-body">
                                  {occ.notes}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(occ.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 ml-4"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add New Occasion */}
      <Card className="border-brand-teal/30 bg-brand-cream-card">
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2 text-brand-dark">
            <Plus className="w-5 h-5 text-brand-teal" />
            Add New Occasion Date
          </CardTitle>
          <CardDescription className="font-body">
            Add or update dates for variable occasions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-brand-dark/70 block mb-2 font-body">
                Occasion Type
              </label>
              <Select
                value={newOccasion.occasionType}
                onValueChange={(value) => setNewOccasion({ ...newOccasion, occasionType: value })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select occasion" />
                </SelectTrigger>
                <SelectContent>
                  {VARIABLE_OCCASIONS.map((occ) => (
                    <SelectItem key={occ} value={occ}>
                      {occ}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-brand-dark/70 block mb-2 font-body">
                Year
              </label>
              <Select
                value={String(newOccasion.year)}
                onValueChange={(value) => setNewOccasion({ ...newOccasion, year: parseInt(value) })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-brand-dark/70 block mb-2 font-body">
                Month
              </label>
              <Select
                value={String(newOccasion.month)}
                onValueChange={(value) => setNewOccasion({ ...newOccasion, month: parseInt(value) })}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {MONTHS.map((month, index) => (
                    <SelectItem key={index} value={String(index + 1)}>
                      {month}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-brand-dark/70 block mb-2 font-body">
                Day
              </label>
              <Input
                type="number"
                min="1"
                max="31"
                value={newOccasion.day}
                onChange={(e) => setNewOccasion({ ...newOccasion, day: parseInt(e.target.value) || 1 })}
                className="h-11"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-brand-dark/70 block mb-2 font-body">
              Notes (optional)
            </label>
            <Textarea
              value={newOccasion.notes}
              onChange={(e) => setNewOccasion({ ...newOccasion, notes: e.target.value })}
              placeholder="e.g., 'Eid al-Fitr 2027 - estimated based on lunar calendar'"
              rows={2}
              className="resize-none"
            />
          </div>

          <Button
            onClick={() => handleSave(newOccasion)}
            disabled={!newOccasion.occasionType || saving}
            className="w-full h-11 bg-brand-teal hover:bg-brand-teal/90 font-body font-semibold"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Occasion Date'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
