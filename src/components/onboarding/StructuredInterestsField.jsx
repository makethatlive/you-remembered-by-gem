import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { STRUCTURED_INTERESTS } from "@/components/shared/taxonomy";

/**
 * Structured interests field with categories and follow-up questions
 * Categories are always visible headers
 * Items with ▸ reveal follow-up questions when selected
 * 
 * Value format: { interests: string[], followUps: { [interest: string]: string[] } }
 */
export default function StructuredInterestsField({ value = { interests: [], followUps: {} }, onChange }) {
  console.log("🔍🔍🔍 STRUCTURED INTERESTS FIELD IS RENDERING 🔍🔍🔍", { value });
  console.log("Value type:", typeof value, "Is array?", Array.isArray(value));
  
  const isInterestChecked = (interest) => {
    return value.interests.includes(interest);
  };

  const toggleInterest = (interest, hasFollowUp) => {
    const isCurrentlyChecked = isInterestChecked(interest);
    
    if (isCurrentlyChecked) {
      // Remove interest and its follow-ups
      const newInterests = value.interests.filter(i => i !== interest);
      const newFollowUps = { ...value.followUps };
      delete newFollowUps[interest];
      onChange({ interests: newInterests, followUps: newFollowUps });
    } else {
      // Add interest
      onChange({ 
        interests: [...value.interests, interest], 
        followUps: value.followUps 
      });
    }
  };

  const isFollowUpChecked = (interest, followUpOption) => {
    return value.followUps[interest]?.includes(followUpOption) || false;
  };

  const toggleFollowUp = (interest, followUpOption) => {
    const currentFollowUps = value.followUps[interest] || [];
    const isCurrentlyChecked = currentFollowUps.includes(followUpOption);
    
    const newFollowUps = { ...value.followUps };
    
    if (isCurrentlyChecked) {
      newFollowUps[interest] = currentFollowUps.filter(f => f !== followUpOption);
      if (newFollowUps[interest].length === 0) {
        delete newFollowUps[interest];
      }
    } else {
      newFollowUps[interest] = [...currentFollowUps, followUpOption];
    }
    
    console.log("🎯 StructuredInterests: toggleFollowUp", { interest, followUpOption, newFollowUps });
    onChange({ interests: value.interests, followUps: newFollowUps });
  };

  return (
    <div className="space-y-5">
      {Object.entries(STRUCTURED_INTERESTS).map(([categoryName, categoryData]) => (
        <div key={categoryName} className="space-y-2.5">
          {/* Category Header - Same styling as field labels */}
          <div className="font-body text-sm text-brand-dark/80 font-semibold mb-2">
            {categoryName}
          </div>

          {/* Category Items - Always Visible */}
          <div className="pl-4 space-y-2">
            {categoryData.items.map((item) => {
              const isChecked = isInterestChecked(item.key);
              console.log(`🔎 Checking ${item.key}:`, { isChecked, hasFollowUp: item.hasFollowUp, followUpOptions: item.followUpOptions });
              
              return (
                <div key={item.key} className="space-y-2">
                  {/* Interest Checkbox */}
                  <label className="flex items-center gap-2.5 font-body text-sm text-brand-dark/80 cursor-pointer">
                    <span className="text-brand-dark/40">•</span>
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={() => toggleInterest(item.key, item.hasFollowUp)}
                      className="border-brand-dark/30 data-[state=checked]:bg-brand-teal data-[state=checked]:border-brand-teal"
                    />
                    <span>
                      {item.key}
                      {item.hasFollowUp && <span className="text-brand-teal ml-1">▸</span>}
                    </span>
                  </label>

                  {/* Follow-up Questions - Only Show When Checked */}
                  {item.hasFollowUp && isChecked && (
                    <div className="pl-10 space-y-1.5 pt-1">
                      {console.log(`🎨 Rendering follow-ups for ${item.key}:`, item.followUpOptions)}
                      {item.followUpOptions.map((followUpOption) => (
                        <label 
                          key={followUpOption} 
                          className="flex items-center gap-2 font-body text-xs text-brand-dark/70 cursor-pointer"
                        >
                          <Checkbox
                            checked={isFollowUpChecked(item.key, followUpOption)}
                            onCheckedChange={() => toggleFollowUp(item.key, followUpOption)}
                            className="border-brand-dark/30 data-[state=checked]:bg-brand-teal data-[state=checked]:border-brand-teal h-3.5 w-3.5"
                          />
                          <span>{followUpOption}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Other Option */}
      <div className="pt-3 border-t border-brand-dark/10 space-y-2">
        <label className="flex items-center gap-2.5 font-body text-sm text-brand-dark/80 cursor-pointer">
          <span className="text-brand-dark/40">•</span>
          <Checkbox
            checked={isInterestChecked("Other")}
            onCheckedChange={() => toggleInterest("Other", false)}
            className="border-brand-dark/30 data-[state=checked]:bg-brand-teal data-[state=checked]:border-brand-teal"
          />
          <span>Other</span>
        </label>
        
        {/* Show text input when "Other" is checked */}
        {isInterestChecked("Other") && (
          <div className="pl-10">
            <input
              type="text"
              value={value.otherText || ""}
              onChange={(e) => onChange({ ...value, otherText: e.target.value })}
              placeholder="Please specify"
              className="w-full h-9 px-3 py-2 text-sm border border-brand-dark/20 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-teal focus:border-transparent"
            />
          </div>
        )}
      </div>
    </div>
  );
}
