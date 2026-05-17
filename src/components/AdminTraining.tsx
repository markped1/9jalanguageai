import React, { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, onSnapshot, deleteDoc, doc,
  serverTimestamp, orderBy, query, updateDoc
} from 'firebase/firestore';
import { db, storage, uploadAudio } from '../lib/firebase';
import {
  Sparkles, Mic, Square, Upload, Trash2, Play, Check,
  X, Plus, BookOpen, MessageSquare, Volume2, Edit2, Save,
  ChevronDown, ChevronUp, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { recordAudioBlob } from '../lib/voice';

// ── Types ─────────────────────────────────────────────────────────────────

type TrainingType = 'conversation' | 'correction' | 'vocabulary' | 'grammar' | 'culture';

interface TrainingEntry {
  id: string;
  type: TrainingType;
  edoText: string;          // Edo phrase / word
  englishText: string;      // English meaning / translation
  context?: string;         // Usage context or grammar note
  audioUrl?: string;        // Admin-recorded pronunciation
  correction?: string;      // What the AI said wrong → what it should say
  createdAt: any;
}

const TYPE_LABELS: Record<TrainingType, { label: string; color: string; desc: string }> = {
  conversation: { label: 'Conversation', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', desc: 'Teach natural Edo dialogue and responses' },
  correction:   { label: 'Correction',   color: 'bg-red-500/20 text-red-400 border-red-500/30',   desc: 'Correct something the AI said wrong' },
  vocabulary:   { label: 'Vocabulary',   color: 'bg-green-500/20 text-green-400 border-green-500/30', desc: 'Add a word or phrase with meaning' },
  grammar:      { label: 'Grammar',      color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', desc: 'Teach a grammar rule or pattern' },
  culture:      { label: 'Culture',      color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', desc: 'Add cultural context or background' },
};

// ── Main Component ────────────────────────────────────────────────────────

export default function AdminTraining() {
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [filter, setFilter] = useState<TrainingType | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Load training entries
  useEffect(() => {
    const q = query(collection(db, 'aiTraining'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() } as TrainingEntry)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const deleteEntry = async (id: string) => {
    await deleteDoc(doc(db, 'aiTraining', id));
  };

  const filtered = filter === 'all' ? entries : entries.filter(e => e.type === filter);
  const counts = entries.reduce((acc, e) => { acc[e.type] = (acc[e.type] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 text-white">
      {/* Header */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-[#5A5A40] rounded-2xl flex items-center justify-center">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-serif">AI Training Studio</h1>
            <p className="text-[10px] text-[#5A5A5A] uppercase tracking-widest">Teach Ọmwan Edo conversational skills</p>
          </div>
        </div>
        <div className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl text-sm text-[#8A8A60] leading-relaxed">
          <Info size={14} className="inline mr-2 text-[#5A5A40]" />
          Everything you add here is injected into the AI's context on every conversation. Teach it correct Edo phrases, fix its mistakes, add grammar rules, and record audio pronunciations.
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-8">
        {(Object.keys(TYPE_LABELS) as TrainingType[]).map(type => (
          <button key={type} onClick={() => setFilter(filter === type ? 'all' : type)}
            className={`p-3 rounded-2xl border text-center transition-all ${filter === type ? TYPE_LABELS[type].color : 'bg-[#1A1A1A] border-[#2A2A2A] text-[#5A5A5A] hover:border-[#5A5A40]'}`}>
            <div className="text-xl font-bold">{counts[type] || 0}</div>
            <div className="text-[9px] uppercase tracking-widest mt-0.5">{TYPE_LABELS[type].label}</div>
          </button>
        ))}
      </div>

      {/* Add button */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-[#5A5A5A]">
          {filtered.length} {filter === 'all' ? 'total' : TYPE_LABELS[filter as TrainingType].label.toLowerCase()} entries
        </p>
        <button onClick={() => setIsAdding(v => !v)}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${isAdding ? 'bg-[#2A2A2A] text-[#5A5A5A]' : 'bg-[#5A5A40] text-white hover:bg-[#6A6A50]'}`}>
          {isAdding ? <X size={16} /> : <Plus size={16} />}
          {isAdding ? 'Cancel' : 'Add Training Entry'}
        </button>
      </div>

      {/* Add form */}
      <AnimatePresence>
        {isAdding && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-8">
            <AddTrainingForm onDone={() => setIsAdding(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Entries list */}
      {loading ? (
        <div className="text-center py-20 text-[#5A5A5A]">Loading training data...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-[#2A2A2A] rounded-3xl text-[#3A3A3A]">
          <Sparkles size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No {filter === 'all' ? '' : TYPE_LABELS[filter as TrainingType].label.toLowerCase() + ' '}entries yet.</p>
          <p className="text-xs mt-1">Add training data to improve Ọmwan's Edo knowledge.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => (
            <TrainingCard
              key={entry.id}
              entry={entry}
              expanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              onDelete={() => deleteEntry(entry.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Training Card ─────────────────────────────────────────────────────────

function TrainingCard({ entry, expanded, onToggle, onDelete }: {
  entry: TrainingEntry;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const meta = TYPE_LABELS[entry.type];

  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl overflow-hidden hover:border-[#3A3A3A] transition-colors">
      <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={onToggle}>
        <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border shrink-0 ${meta.color}`}>
          {meta.label}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{entry.edoText}</p>
          <p className="text-xs text-[#5A5A5A] truncate">{entry.englishText}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {entry.audioUrl && (
            <button onClick={e => { e.stopPropagation(); new Audio(entry.audioUrl!).play(); }}
              className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors">
              <Volume2 size={14} />
            </button>
          )}
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 text-[#3A3A3A] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
            <Trash2 size={14} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-[#5A5A5A]" /> : <ChevronDown size={16} className="text-[#5A5A5A]" />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-0 border-t border-[#2A2A2A] space-y-3">
              <div className="grid md:grid-cols-2 gap-3 pt-3">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-[#5A5A5A] mb-1">Edo</p>
                  <p className="text-base font-serif text-white">{entry.edoText}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-[#5A5A5A] mb-1">English</p>
                  <p className="text-sm text-[#C9D1D9]">{entry.englishText}</p>
                </div>
              </div>
              {entry.context && (
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-[#5A5A5A] mb-1">Context / Note</p>
                  <p className="text-xs text-[#8A8A60] leading-relaxed">{entry.context}</p>
                </div>
              )}
              {entry.correction && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-[9px] uppercase tracking-widest text-red-400 mb-1">AI Correction</p>
                  <p className="text-xs text-[#C9D1D9]">{entry.correction}</p>
                </div>
              )}
              {entry.audioUrl && (
                <div className="flex items-center gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <Volume2 size={16} className="text-blue-400 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[9px] uppercase tracking-widest text-blue-400 mb-0.5">Audio Recording</p>
                    <p className="text-xs text-[#5A5A5A]">Admin pronunciation saved</p>
                  </div>
                  <button onClick={() => new Audio(entry.audioUrl!).play()}
                    className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-500/30 transition-colors flex items-center gap-1">
                    <Play size={12} fill="currentColor" /> Play
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Add Training Form ─────────────────────────────────────────────────────

function AddTrainingForm({ onDone }: { onDone: () => void }) {
  const [type, setType] = useState<TrainingType>('conversation');
  const [edoText, setEdoText] = useState('');
  const [englishText, setEnglishText] = useState('');
  const [context, setContext] = useState('');
  const [correction, setCorrection] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const recorderRef = useRef<{ stop: () => void } | null>(null);
  const timerRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    setIsRecording(true);
    setRecordingSeconds(0);
    setAudioBlob(null);
    timerRef.current = setInterval(() => setRecordingSeconds(s => s + 1), 1000);
    const recorder = recordAudioBlob((s) => {
      if (s === 'error' || s === 'done') { setIsRecording(false); clearInterval(timerRef.current); }
    });
    recorderRef.current = recorder;
    const { blob } = await recorder.promise;
    setIsRecording(false);
    clearInterval(timerRef.current);
    recorderRef.current = null;
    setAudioBlob(blob);
    setAudioPreviewUrl(URL.createObjectURL(blob));
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setIsRecording(false);
    clearInterval(timerRef.current);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioBlob(file);
    setAudioPreviewUrl(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!edoText.trim() || !englishText.trim()) return;
    setSaving(true);
    try {
      let audioUrl: string | undefined;
      if (audioBlob) {
        audioUrl = await uploadAudio(`training-audio/${Date.now()}-${edoText.slice(0, 20)}.webm`, audioBlob);
      }

      const entry: any = {
        type,
        edoText: edoText.trim(),
        englishText: englishText.trim(),
        createdAt: serverTimestamp(),
      };
      if (context.trim()) entry.context = context.trim();
      if (correction.trim()) entry.correction = correction.trim();
      if (audioUrl) entry.audioUrl = audioUrl;

      await addDoc(collection(db, 'aiTraining'), entry);
      onDone();
    } catch (err) {
      console.error('Failed to save training entry', err);
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-[#0F0F0F] border border-[#2A2A2A] rounded-xl px-4 py-3 text-sm text-white placeholder-[#3A3A3A] focus:outline-none focus:ring-2 focus:ring-[#5A5A40] focus:border-[#5A5A40] transition-colors';

  return (
    <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-3xl p-6 space-y-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-8 h-8 bg-[#5A5A40] rounded-xl flex items-center justify-center">
          <Plus size={16} />
        </div>
        <h3 className="font-serif text-lg">New Training Entry</h3>
      </div>

      {/* Type selector */}
      <div>
        <label className="text-[10px] uppercase tracking-widest text-[#5A5A5A] font-bold mb-2 block">Entry Type</label>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TYPE_LABELS) as TrainingType[]).map(t => (
            <button key={t} type="button" onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all ${type === t ? TYPE_LABELS[t].color : 'bg-transparent border-[#2A2A2A] text-[#5A5A5A] hover:border-[#5A5A40]'}`}>
              {TYPE_LABELS[t].label}
            </button>
          ))}
        </div>
        <p className="text-xs text-[#3A3A3A] mt-2">{TYPE_LABELS[type].desc}</p>
      </div>

      {/* Main fields */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-[#5A5A5A] font-bold mb-2 block">
            Edo Text <span className="text-red-400">*</span>
          </label>
          <textarea
            value={edoText}
            onChange={e => setEdoText(e.target.value)}
            placeholder={type === 'conversation' ? 'e.g. Vbẹe oye hẹ? — Ọyese, uru ese.' : type === 'correction' ? 'e.g. Kọyo (not Koyo)' : 'e.g. Ifiẹ'}
            rows={3}
            className={inputClass + ' resize-none'}
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-[#5A5A5A] font-bold mb-2 block">
            English Meaning <span className="text-red-400">*</span>
          </label>
          <textarea
            value={englishText}
            onChange={e => setEnglishText(e.target.value)}
            placeholder={type === 'conversation' ? 'e.g. How are you? — I am fine, thank you.' : type === 'correction' ? 'e.g. Hello (the correct Edo spelling uses ọ not o)' : 'e.g. Love'}
            rows={3}
            className={inputClass + ' resize-none'}
          />
        </div>
      </div>

      {/* Context */}
      <div>
        <label className="text-[10px] uppercase tracking-widest text-[#5A5A5A] font-bold mb-2 block">
          Context / Usage Note <span className="text-[#3A3A3A]">(optional)</span>
        </label>
        <input
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder={type === 'grammar' ? 'e.g. Used when emphasising the subject of a sentence' : 'e.g. Used as a casual greeting between friends, not formal'}
          className={inputClass}
        />
      </div>

      {/* Correction field — only for correction type */}
      {type === 'correction' && (
        <div>
          <label className="text-[10px] uppercase tracking-widest text-red-400 font-bold mb-2 block">
            What the AI said wrong → What it should say
          </label>
          <input
            value={correction}
            onChange={e => setCorrection(e.target.value)}
            placeholder='e.g. AI said "Koyo" but the correct form is "Kọyo" with a dot under the o'
            className={inputClass + ' border-red-500/30 focus:ring-red-500/50'}
          />
        </div>
      )}

      {/* Audio recording */}
      <div>
        <label className="text-[10px] uppercase tracking-widest text-[#5A5A5A] font-bold mb-2 block">
          Audio Pronunciation <span className="text-[#3A3A3A]">(optional but recommended)</span>
        </label>
        <div className="flex items-center gap-3 flex-wrap">
          <button type="button" onClick={isRecording ? stopRecording : startRecording}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#5A5A40] text-white hover:bg-[#6A6A50]'}`}>
            {isRecording ? <Square size={14} fill="currentColor" /> : <Mic size={14} />}
            {isRecording ? `Stop (${recordingSeconds}s)` : 'Record Pronunciation'}
          </button>

          <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleFileUpload} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-[#2A2A2A] text-[#8A8A60] hover:bg-[#3A3A3A] transition-all">
            <Upload size={14} /> Upload Audio
          </button>

          {audioPreviewUrl && (
            <>
              <button type="button" onClick={() => new Audio(audioPreviewUrl).play()}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 transition-all">
                <Play size={14} fill="currentColor" /> Preview
              </button>
              <button type="button" onClick={() => { setAudioBlob(null); setAudioPreviewUrl(null); }}
                className="p-2 text-[#3A3A3A] hover:text-red-400 transition-colors">
                <Trash2 size={16} />
              </button>
              <span className="text-xs text-green-400 font-bold">✓ Audio ready</span>
            </>
          )}
          {isRecording && <span className="text-xs text-red-400 animate-pulse font-bold">Recording... press Stop when done</span>}
        </div>
      </div>

      {/* Save / Cancel */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#2A2A2A]">
        <button type="button" onClick={onDone} className="px-5 py-2.5 text-sm text-[#5A5A5A] hover:text-white transition-colors">
          Cancel
        </button>
        <button type="button" onClick={handleSave}
          disabled={!edoText.trim() || !englishText.trim() || saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-[#5A5A40] text-white rounded-xl text-sm font-bold hover:bg-[#6A6A50] transition-all disabled:opacity-40 disabled:cursor-not-allowed">
          {saving ? 'Saving...' : <><Save size={14} /> Save Training Entry</>}
        </button>
      </div>
    </div>
  );
}
