import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Sparkles, Volume2, VolumeX, User, Loader2,
  Mic, MicOff, Paperclip, X, Image, FileAudio,
  ChevronDown, StopCircle, Copy, Check, Code2, Square, Radio,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User as FirebaseUser } from 'firebase/auth';
import { getEdoChat, ChatAttachment, transcribeWithWhisper } from '../lib/ai';
import { useLexicon, seedLexiconToFirestore } from '../lib/useLexicon';
import { ChatMessage } from '../types';
import { recordAudioBlob, playEdoSpeech, customAudioCache } from '../lib/voice';

interface EdoAssistantProps {
  user: FirebaseUser;
  isAdmin: boolean;
}

const SUGGESTIONS = [
  { label: 'Greet in Edo', prompt: 'How do I say hello and good morning in Edo?' },
  { label: 'Build a website', prompt: 'Build me a beautiful 3-page website for a restaurant with HTML, CSS and JavaScript' },
  { label: 'Gha mwen app', prompt: 'I hia u gha mwen todo app vbe HTML na CSS' },
  { label: 'Explain science', prompt: 'Explain how black holes work in simple terms' },
  { label: 'Edo culture', prompt: 'Tell me about the Igue festival and Edo culture' },
  { label: 'Gha mwen calculator', prompt: 'Gha mwen calculator vbe JavaScript' },
  { label: 'Lecture me', prompt: 'Give me a lecture on the history of artificial intelligence' },
  { label: 'Translate to Edo', prompt: 'Translate these sentences to Edo: I love you. Where are you going? Thank you very much.' },
];

// ── Code block with copy button ───────────────────────────────────────────
function CodeBlock({ children, className }: { children: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const lang = className?.replace('language-', '') ?? 'code';

  const copy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[#2A2A2A] bg-[#0A0A0A]">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1A1A1A] border-b border-[#2A2A2A]">
        <div className="flex items-center gap-2">
          <Code2 size={12} className="text-[#5A5A40]" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A5A]">{lang}</span>
        </div>
        <button
          onClick={copy}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#5A5A5A] hover:text-white transition-colors"
        >
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed text-[#C9D1D9] font-mono">
        <code>{children}</code>
      </pre>
    </div>
  );
}

// ── Markdown renderer with custom code blocks ─────────────────────────────
function MessageContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }: any) {
          const isBlock = !props.inline;
          const text = String(children).replace(/\n$/, '');
          if (isBlock) {
            return <CodeBlock className={className}>{text}</CodeBlock>;
          }
          return (
            <code className="px-1.5 py-0.5 bg-[#2A2A2A] text-[#8A8A60] rounded text-xs font-mono" {...props}>
              {children}
            </code>
          );
        },
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        h1: ({ children }) => <h1 className="text-lg font-bold text-white mb-2 mt-3">{children}</h1>,
        h2: ({ children }) => <h2 className="text-base font-bold text-white mb-2 mt-3">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-bold text-[#8A8A60] mb-1 mt-2 uppercase tracking-wide">{children}</h3>,
        strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[#5A5A40] pl-3 my-2 text-[#8A8A60] italic">{children}</blockquote>
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto my-3">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        th: ({ children }) => <th className="border border-[#2A2A2A] px-3 py-2 bg-[#1A1A1A] text-left font-bold text-[#8A8A60] uppercase tracking-wide">{children}</th>,
        td: ({ children }) => <td className="border border-[#2A2A2A] px-3 py-2 text-[#C9D1D9]">{children}</td>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="text-[#5A5A40] hover:text-[#8A8A60] underline underline-offset-2 transition-colors">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ── Streaming message bubble — shows a blinking cursor while streaming ────
function StreamingBubble({ content, done }: { content: string; done: boolean }) {
  return (
    <div className="px-5 py-4 bg-[#1A1A1A] text-[#E5E5E5] rounded-2xl rounded-tl-sm border border-[#2A2A2A] text-sm">
      <MessageContent content={content} />
      {!done && (
        <span className="inline-block w-2 h-4 bg-[#5A5A40] ml-0.5 animate-pulse rounded-sm align-middle" />
      )}
    </div>
  );
}

export default function EdoAssistant({ user, isAdmin }: EdoAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  // Track which AI message index is currently being spoken (null = none)
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);

  const { vocabContextString, trainingContext } = useLexicon();
  const chatRef = useRef<ReturnType<typeof getEdoChat> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const micRecorderRef = useRef<{ stop: () => void } | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    chatRef.current = getEdoChat();
    seedLexiconToFirestore().catch(() => {});
  }, []);

  // Auto-scroll while streaming
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 200;
    if (isNearBottom) el.scrollTop = el.scrollHeight;
  }, [messages, streamingContent, isLoading]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 300);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 160) + 'px';
  }, [input]);

  // ── TTS ───────────────────────────────────────────────────────────────────
  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel();
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
    setIsSpeaking(false);
    setSpeakingIdx(null);
  }, []);

  const speakText = useCallback((text: string, idx?: number, onDone?: () => void) => {
    window.speechSynthesis?.cancel();
    if (currentAudioRef.current) { currentAudioRef.current.pause(); currentAudioRef.current = null; }
    setIsSpeaking(true);
    if (idx !== undefined) setSpeakingIdx(idx);

    // Strip markdown/code blocks for TTS
    const clean = text.replace(/```[\s\S]*?```/g, 'code block').replace(/[*#_`]/g, '');

    // Check if the entire text (trimmed) matches a cached Edo word exactly
    const normalized = clean.toLowerCase().trim();
    if (customAudioCache[normalized]) {
      const audio = new Audio(customAudioCache[normalized]);
      currentAudioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); setSpeakingIdx(null); onDone?.(); };
      audio.onerror = () => { setIsSpeaking(false); setSpeakingIdx(null); onDone?.(); };
      audio.play().catch(() => {
        // fallback to TTS if audio fails
        browserTTS(clean, idx, onDone);
      });
      return;
    }

    // For longer responses, use browser TTS (cache is word-level, not sentence-level)
    browserTTS(clean, idx, onDone);
  }, []);

  const browserTTS = (clean: string, idx?: number, onDone?: () => void) => {
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.lang.includes('en-NG'))
      || voices.find(v => v.lang.includes('en-GB'))
      || voices.find(v => v.lang.includes('en-US'));
    if (preferred) utterance.voice = preferred;
    utterance.onend = () => { setIsSpeaking(false); setSpeakingIdx(null); onDone?.(); };
    utterance.onerror = () => { setIsSpeaking(false); setSpeakingIdx(null); onDone?.(); };
    window.speechSynthesis.speak(utterance);
  };

  const speakMessage = useCallback((text: string, idx: number) => {
    // Extract the first Edo word/phrase from the response
    // Try exact cache match first, then fall back to full TTS
    const firstLine = text.split('\n')[0].trim();
    const normalized = firstLine.toLowerCase().replace(/[*#_`]/g, '').trim();

    // Check cache for exact match or partial match
    const cacheKey = Object.keys(customAudioCache).find(k =>
      normalized.startsWith(k) || normalized.includes(k)
    );

    if (cacheKey && customAudioCache[cacheKey]) {
      setIsSpeaking(true);
      setSpeakingIdx(idx);
      const audio = new Audio(customAudioCache[cacheKey]);
      currentAudioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); setSpeakingIdx(null); };
      audio.onerror = () => { speakText(text, idx); };
      audio.play().catch(() => speakText(text, idx));
      return;
    }
    speakText(text, idx);
  }, [speakText]);

  const sendMessage = useCallback(async (text: string, atts: ChatAttachment[] = []) => {
    if ((!text.trim() && atts.length === 0) || isLoading || isStreaming) return;

    const userMsg: ChatMessage = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setIsLoading(true);
    abortRef.current = false;

    try {
      if (!chatRef.current) chatRef.current = getEdoChat();

      setIsLoading(false);
      setIsStreaming(true);
      setStreamingContent('');

      let fullText = '';
      const stream = chatRef.current.sendMessageStream({
        message: text,
        attachments: atts,
        vocabContext: [vocabContextString, trainingContext].filter(Boolean).join('\n\n--- ADMIN TRAINING DATA ---\n') || undefined,
      });

      for await (const chunk of stream) {
        if (abortRef.current) break;
        fullText += chunk;
        setStreamingContent(fullText);
      }

      setIsStreaming(false);
      setStreamingContent('');
      const modelMsg: ChatMessage = {
        role: 'model',
        content: fullText,
        timestamp: Date.now(),
      };
      setMessages(prev => {
        const next = [...prev, modelMsg];
        // In voice mode or autoSpeak, speak the new AI message
        // We use the index of the newly added model message
        if ((autoSpeak || voiceMode) && !abortRef.current) {
          const modelIdx = next.filter(m => m.role === 'model').length - 1;
          // Delay slightly to let state settle
          setTimeout(() => speakText(fullText, modelIdx), 100);
        }
        return next;
      });

    } catch (err) {
      console.error('Chat error:', err);
      setIsStreaming(false);
      setStreamingContent('');
      setMessages(prev => [...prev, {
        role: 'model',
        content: 'Ọyese — I encountered an issue. Please try again.',
        timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isStreaming, vocabContextString, trainingContext, autoSpeak, voiceMode, speakText]);

  const stopGeneration = () => {
    abortRef.current = true;
    setIsStreaming(false);
    if (streamingContent) {
      setMessages(prev => [...prev, {
        role: 'model',
        content: streamingContent,
        timestamp: Date.now(),
      }]);
      setStreamingContent('');
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    sendMessage(input, attachments);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // ── Whisper mic ───────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (isListening) {
      micRecorderRef.current?.stop();
      setIsListening(false);
      return;
    }
    setIsListening(true);
    const recorder = recordAudioBlob((status) => {
      if (status === 'error') setIsListening(false);
    });
    micRecorderRef.current = recorder;
    recorder.promise
      .then(async ({ blob }) => {
        setIsListening(false);
        if (voiceMode) {
          // In voice mode: transcribe then auto-send
          setInput('⏳ Transcribing...');
          const transcript = await transcribeWithWhisper(blob);
          setInput('');
          if (transcript) {
            sendMessage(transcript, []);
          }
        } else {
          setInput('⏳ Transcribing...');
          const transcript = await transcribeWithWhisper(blob);
          setInput(transcript || '');
          inputRef.current?.focus();
        }
      })
      .catch(() => { setIsListening(false); setInput(''); });
  }, [isListening, voiceMode, sendMessage]);

  // ── File attach ───────────────────────────────────────────────────────────
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    Array.from(e.target.files ?? []).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        const type: ChatAttachment['type'] = file.type.startsWith('image/') ? 'image' : file.type.startsWith('audio/') ? 'audio' : 'url';
        setAttachments(prev => [...prev, { type, name: file.name, data: base64, mimeType: file.type }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const isEmpty = messages.length === 0 && !isStreaming && !isLoading;

  // Compute per-message model index for speaker tracking
  // We need to map overall message index → model-only index
  const modelIndexMap: number[] = [];
  let modelCount = 0;
  messages.forEach(msg => {
    if (msg.role === 'model') {
      modelIndexMap.push(modelCount++);
    } else {
      modelIndexMap.push(-1);
    }
  });

  return (
    <div className="flex flex-col h-screen bg-[#0F0F0F] text-white relative">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1E1E1E] shrink-0">
        {/* Left: logo + name + online */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#5A5A40] rounded-xl flex items-center justify-center">
            <Sparkles size={16} />
          </div>
          <div>
            <h1 className="font-serif text-base leading-none">Ọmwan</h1>
            <p className="text-[10px] text-[#5A5A5A] uppercase tracking-widest">Edo Language &amp; Code AI</p>
          </div>
          <div className="flex items-center gap-1.5 ml-1 px-2 py-1 bg-[#1A1A1A] rounded-full border border-[#2A2A2A]">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[9px] text-[#5A5A5A] uppercase tracking-widest">Online</span>
          </div>
          {voiceMode && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 rounded-full border border-red-500/30">
              <Radio size={10} className="text-red-400 animate-pulse" />
              <span className="text-[9px] text-red-400 uppercase tracking-widest font-bold">Voice Mode Active</span>
            </div>
          )}
        </div>

        {/* Right: voice mode toggle + auto-speak + stop + avatar */}
        <div className="flex items-center gap-2">
          {/* Voice Mode toggle */}
          <button
            onClick={() => setVoiceMode(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${
              voiceMode
                ? 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
                : 'text-[#5A5A5A] border-[#2A2A2A] hover:border-[#5A5A40] hover:text-white'
            }`}
          >
            <Radio size={12} />
            Voice Mode
          </button>



          {/* Stop speaking button — shown when any speech is active */}
          {isSpeaking && (
            <button
              onClick={stopSpeaking}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
            >
              <StopCircle size={12} /> Stop
            </button>
          )}

          {/* User avatar */}
          {user.photoURL && (
            <img
              src={user.photoURL}
              alt=""
              className="w-7 h-7 rounded-full border border-[#2A2A2A]"
              referrerPolicy="no-referrer"
            />
          )}
        </div>
      </div>

      {/* ── Messages ── */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">

        {/* Empty state */}
        {isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
          >
            <div className="w-16 h-16 bg-[#5A5A40] rounded-3xl flex items-center justify-center mb-6 shadow-2xl">
              <Sparkles size={28} />
            </div>
            <h2 className="text-2xl font-serif mb-2">Kọyo! I am Ọmwan</h2>
            <p className="text-[#5A5A5A] text-sm max-w-lg mb-10 leading-relaxed">
              Your Edo language guide and coding assistant. Write what you want to build{' '}
              <span className="text-[#8A8A60] font-medium">in Edo language</span> — say{' '}
              <span className="text-[#8A8A60] italic">"Gha mwen website"</span> or{' '}
              <span className="text-[#8A8A60] italic">"I hia u gha app"</span> — and I will build it for you.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-3xl">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => sendMessage(s.prompt)}
                  className="p-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl text-left hover:border-[#5A5A40] hover:bg-[#1E1E1E] transition-all group"
                >
                  <p className="text-xs font-bold text-[#5A5A40] uppercase tracking-widest mb-1 group-hover:text-[#8A8A60]">{s.label}</p>
                  <p className="text-xs text-[#6A6A6A] leading-relaxed line-clamp-2">{s.prompt}</p>
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Message list */}
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const modelIdx = modelIndexMap[idx];
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'ml-auto flex-row-reverse max-w-2xl' : 'mr-auto max-w-3xl w-full'}`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1 ${msg.role === 'user' ? 'bg-[#2A2A2A]' : 'bg-[#5A5A40]'}`}>
                  {msg.role === 'user'
                    ? (user.photoURL
                        ? <img src={user.photoURL} alt="" className="w-8 h-8 rounded-xl" referrerPolicy="no-referrer" />
                        : <User size={16} />)
                    : <Sparkles size={16} />}
                </div>
                <div className={`flex flex-col gap-2 min-w-0 flex-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="px-5 py-4 bg-[#5A5A40] text-white rounded-2xl rounded-tr-sm text-sm whitespace-pre-wrap max-w-full">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="px-5 py-4 bg-[#1A1A1A] text-[#E5E5E5] rounded-2xl rounded-tl-sm border border-[#2A2A2A] text-sm w-full">
                      <MessageContent content={msg.content} />
                    </div>
                  )}

                  {/* Per-message speaker button for AI messages */}
                  {msg.role === 'model' && (
                    <div className="flex items-center gap-3 px-1">
                      <button
                        onClick={() =>
                          speakingIdx === modelIdx
                            ? stopSpeaking()
                            : speakMessage(msg.content, modelIdx)
                        }
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                          speakingIdx === modelIdx
                            ? 'bg-[#5A5A40] text-white border-[#5A5A40] animate-pulse'
                            : 'text-[#5A5A5A] border-[#2A2A2A] hover:border-[#5A5A40] hover:text-white'
                        }`}
                      >
                        {speakingIdx === modelIdx ? <VolumeX size={14} /> : <Volume2 size={14} />}
                        {speakingIdx === modelIdx ? 'Speaking...' : 'Listen'}
                      </button>
                      <span className="text-[#2A2A2A]">·</span>
                      <span className="text-[10px] text-[#3A3A3A]">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* Streaming bubble */}
          {isStreaming && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 mr-auto max-w-3xl w-full">
              <div className="w-8 h-8 rounded-xl bg-[#5A5A40] flex items-center justify-center shrink-0 mt-1">
                <Sparkles size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <StreamingBubble content={streamingContent} done={false} />
              </div>
            </motion.div>
          )}

          {/* Loading dots (pre-stream) */}
          {isLoading && !isStreaming && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 mr-auto">
              <div className="w-8 h-8 rounded-xl bg-[#5A5A40] flex items-center justify-center shrink-0 mt-1">
                <Sparkles size={16} />
              </div>
              <div className="px-5 py-4 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl rounded-tl-sm flex items-center gap-1.5">
                <span className="w-2 h-2 bg-[#5A5A40] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-[#5A5A40] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-[#5A5A40] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scroll to bottom */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={scrollToBottom}
            className="absolute bottom-28 right-8 p-2 bg-[#5A5A40] text-white rounded-full shadow-lg hover:bg-[#6A6A50] transition-all z-10"
          >
            <ChevronDown size={18} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Input area ── */}
      <div className="shrink-0 px-4 md:px-8 pb-6 pt-3 border-t border-[#1E1E1E]">
        {attachments.length > 0 && (
          <div className="flex gap-2 mb-3 flex-wrap">
            {attachments.map((att, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-[#1A1A1A] border border-[#2A2A2A] rounded-xl text-xs text-[#8A8A60]">
                {att.type === 'image' ? <Image size={12} /> : <FileAudio size={12} />}
                <span className="max-w-[120px] truncate">{att.name}</span>
                <button
                  onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                  className="text-[#5A5A5A] hover:text-red-400 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl px-4 py-3 focus-within:border-[#5A5A40] transition-colors max-w-4xl mx-auto">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,audio/*"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 text-[#5A5A5A] hover:text-[#8A8A60] transition-colors shrink-0 mb-0.5"
            title="Attach file"
          >
            <Paperclip size={18} />
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? '🎤 Recording — click mic to stop...'
                : voiceMode
                ? '🎙 Voice Mode — click the mic to speak...'
                : 'Ask in English or Edo, write code, paste a URL...'
            }
            rows={1}
            disabled={isLoading || isStreaming}
            className="flex-1 bg-transparent text-sm text-white placeholder-[#3A3A3A] outline-none resize-none leading-relaxed max-h-40 overflow-y-auto"
          />

          {/* Auto-speak (Listen) toggle */}
          <button
            type="button"
            onClick={() => setAutoSpeak(v => !v)}
            className={`p-1.5 shrink-0 mb-0.5 rounded-lg transition-all ${
              autoSpeak
                ? 'text-green-400 bg-green-500/10'
                : 'text-[#5A5A5A] hover:text-[#8A8A60]'
            }`}
            title={autoSpeak ? 'Auto-speak ON' : 'Auto-speak OFF'}
          >
            {autoSpeak ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Mic button — large pulsing circle in voice mode */}
          {voiceMode ? (
            <button
              type="button"
              onClick={startListening}
              className={`shrink-0 rounded-full transition-all flex items-center justify-center ${
                isListening
                  ? 'w-12 h-12 bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50'
                  : 'w-12 h-12 bg-red-500/80 text-white hover:bg-red-500 shadow-md'
              }`}
              title={isListening ? 'Stop recording' : 'Start voice input'}
            >
              {isListening ? <MicOff size={22} /> : <Mic size={22} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={startListening}
              className={`p-1.5 shrink-0 mb-0.5 rounded-lg transition-all ${
                isListening
                  ? 'text-red-400 bg-red-500/10 animate-pulse'
                  : 'text-[#5A5A5A] hover:text-[#8A8A60]'
              }`}
              title={isListening ? 'Stop' : 'Voice input'}
            >
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          )}

          {/* Stop generation / Send button */}
          {isStreaming ? (
            <button
              type="button"
              onClick={stopGeneration}
              className="p-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl hover:bg-red-500/30 transition-all shrink-0"
            >
              <Square size={16} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={(!input.trim() && attachments.length === 0) || isLoading}
              className="p-2 bg-[#5A5A40] text-white rounded-xl hover:bg-[#6A6A50] transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 shadow-md active:scale-95"
            >
              {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          )}
        </div>

        <p className="text-center text-[10px] text-[#2A2A2A] mt-2 uppercase tracking-widest">
          Ọmwan · Groq Llama 3.3 · Edo Language &amp; Code AI
        </p>
      </div>
    </div>
  );
}
