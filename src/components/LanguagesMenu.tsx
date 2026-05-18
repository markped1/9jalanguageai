import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Globe, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NIGERIAN_LANGUAGES, Region, Language } from '../lib/nigerianLanguages';

interface LanguagesMenuProps {
  onSelectLanguage: (languageId: string, languageName: string) => void;
}

export default function LanguagesMenu({ onSelectLanguage }: LanguagesMenuProps) {
  const [expandedRegions, setExpandedRegions] = useState<string[]>(['south-south']); // Edo region expanded by default

  const toggleRegion = (regionId: string) => {
    setExpandedRegions(prev =>
      prev.includes(regionId)
        ? prev.filter(id => id !== regionId)
        : [...prev, regionId]
    );
  };

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-br from-[#008751] to-[#00A862] rounded-2xl flex items-center justify-center">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-serif text-[#008751] tracking-tight">Nigerian Languages</h1>
              <p className="text-sm text-[#008751]/60 mt-1">Explore and learn languages from all regions of Nigeria</p>
            </div>
          </div>
        </div>

        {/* Regions */}
        <div className="space-y-4">
          {NIGERIAN_LANGUAGES.map((region) => (
            <div key={region.id} className="border-2 border-[#008751]/20 rounded-2xl overflow-hidden bg-white shadow-sm">
              {/* Region Header */}
              <button
                onClick={() => toggleRegion(region.id)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#008751]/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expandedRegions.includes(region.id) ? (
                    <ChevronDown className="w-5 h-5 text-[#008751]" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-[#008751]" />
                  )}
                  <h2 className="text-xl font-serif text-[#008751]">{region.name}</h2>
                  <span className="text-xs text-[#008751]/60 font-bold uppercase tracking-widest">
                    {region.languages.length} {region.languages.length === 1 ? 'Language' : 'Languages'}
                  </span>
                </div>
              </button>

              {/* Languages List */}
              <AnimatePresence>
                {expandedRegions.includes(region.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-4 space-y-3">
                      {region.languages.map((language) => (
                        <button
                          key={language.id}
                          onClick={() => onSelectLanguage(language.id, language.name)}
                          className="w-full p-4 bg-[#008751]/5 hover:bg-[#008751]/10 border border-[#008751]/20 hover:border-[#008751]/40 rounded-xl transition-all text-left group"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-lg font-serif text-[#008751] group-hover:text-[#00A862]">
                                  {language.name}
                                </h3>
                                <span className="text-sm text-[#008751]/60 italic">
                                  ({language.nativeName})
                                </span>
                              </div>
                              <p className="text-sm text-[#008751]/70 mb-2 leading-relaxed">
                                {language.description}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-[#008751]/60">
                                <div className="flex items-center gap-1">
                                  <Users size={12} />
                                  <span>{language.speakers} speakers</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Globe size={12} />
                                  <span>{language.states.join(', ')}</span>
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0">
                              <div className="w-10 h-10 bg-gradient-to-br from-[#008751] to-[#00A862] rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <ChevronRight className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-12 p-6 bg-gradient-to-br from-[#008751]/10 to-[#00A862]/10 border-2 border-[#008751]/20 rounded-2xl">
          <h3 className="text-lg font-serif text-[#008751] mb-2">About Nigerian Languages</h3>
          <p className="text-sm text-[#008751]/70 leading-relaxed">
            Nigeria is home to over 500 languages, making it one of the most linguistically diverse countries in the world. 
            The languages listed here represent the major languages spoken across Nigeria's six geopolitical zones. 
            Each language has its own rich history, culture, and traditions.
          </p>
        </div>
      </div>
    </div>
  );
}
