import React from 'react';
import { Sparkles, MessageSquare } from 'lucide-react';
import { motion } from 'motion/react';
import { User as FirebaseUser } from 'firebase/auth';

interface GeneralAssistantProps {
  user?: FirebaseUser | null;
  isAdmin?: boolean;
}

export default function GeneralAssistant({ user, isAdmin }: GeneralAssistantProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-white px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-2xl"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-[#008751] to-[#00A862] rounded-3xl flex items-center justify-center mb-6 shadow-2xl mx-auto">
          <Sparkles size={32} className="text-white" />
        </div>
        
        <h1 className="text-5xl font-serif text-[#008751] mb-4 tracking-tight">
          Welcome to 9ja AI
        </h1>
        
        <p className="text-lg text-[#008751]/80 mb-8 leading-relaxed">
          Your intelligent guide to Nigerian languages and cultures
        </p>
        
        <p className="text-sm text-[#008751]/60 mb-12 leading-relaxed max-w-xl mx-auto">
          Explore and learn languages from all regions of Nigeria. Ask questions, learn phrases, translate, and discover the rich cultural heritage of Nigerian languages.
        </p>

        <div className="grid md:grid-cols-2 gap-4 max-w-xl mx-auto">
          <div className="p-6 bg-[#008751]/5 border-2 border-[#008751]/20 rounded-2xl text-left hover:border-[#008751]/40 transition-all">
            <MessageSquare className="w-8 h-8 text-[#008751] mb-3" />
            <h3 className="text-lg font-serif text-[#008751] mb-2">Languages</h3>
            <p className="text-sm text-[#008751]/70">
              Browse Nigerian languages by region and start learning
            </p>
          </div>
          
          <div className="p-6 bg-[#008751]/5 border-2 border-[#008751]/20 rounded-2xl text-left hover:border-[#008751]/40 transition-all">
            <Sparkles className="w-8 h-8 text-[#008751] mb-3" />
            <h3 className="text-lg font-serif text-[#008751] mb-2">AI Assistant</h3>
            <p className="text-sm text-[#008751]/70">
              Get help with translations, coding, and cultural questions
            </p>
          </div>
        </div>

        <div className="mt-12 p-4 bg-[#008751]/5 border border-[#008751]/20 rounded-xl">
          <p className="text-xs text-[#008751]/60">
            👈 Use the sidebar to explore languages or access the AI assistant
          </p>
        </div>
      </motion.div>
    </div>
  );
}
