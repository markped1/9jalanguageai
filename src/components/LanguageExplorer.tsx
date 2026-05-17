import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, orderBy, Timestamp } from 'firebase/firestore';
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut, User } from 'firebase/auth';
import { db, auth, uploadAudio } from '../lib/firebase';
import { Languages, Book, Scroll, Map, Volume2, Mic, CheckCircle2, ChevronRight, Share2, MessageSquare, Play, User as UserIcon, Users, XCircle, Loader2, Square, Edit2, Check, X, LogIn, LogOut, Sparkles, Database, Upload, FileAudio, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { speak, playEdoSpeech, recordSpeech, recordAudioBlob, EDO_PERSONAS, VoicePersona, customAudioCache } from '../lib/voice';
import EdoAssistant from './EdoAssistant';
import { LINGUISTIC_REPOSITORY } from '../lib/repository';
import { useLexicon, seedLexiconToFirestore } from '../lib/useLexicon';
import { transcribeEdoAudio } from '../lib/ai';
import { storage } from '../lib/firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  // Only log if it's not a common transient error
  if (!errInfo.error.includes('unavailable')) {
    console.error('Firestore Error: ', JSON.stringify(errInfo));
  }
  throw new Error(JSON.stringify(errInfo));
}

export default function LanguageExplorer({ 
  languageName, 
  currentUser, 
  isAdmin 
}: { 
  languageName: string, 
  currentUser?: User | null, 
  isAdmin?: boolean 
}) {
  const [language, setLanguage] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<'overview' | 'dictionary' | 'practice' | 'assistant' | 'repository'>(() => {
    return (localStorage.getItem('explorer_active_section') as any) || 'overview';
  });
  const [loading, setLoading] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState<VoicePersona>(EDO_PERSONAS[0]);
  const [personalVocab, setPersonalVocab] = useState<any[]>([]);
  const [communityVocab, setCommunityVocab] = useState<any[]>([]);
  const [isAddingWord, setIsAddingWord] = useState(false);

  useEffect(() => {
    localStorage.setItem('explorer_active_section', activeSection);
  }, [activeSection]);

  const { categories: lexiconCategories, loading: lexiconLoading } = useLexicon();

  // Firestore Sync for Personal Vocab
  useEffect(() => {
    if (!currentUser) {
      setPersonalVocab([]);
      return;
    }

    const path = `users/${currentUser.uid}/personalVocab`;
    const vocabRef = collection(db, path);
    const q = query(vocabRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPersonalVocab(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return unsubscribe;
  }, [currentUser]);

  // Firestore Sync for Community Vocab
  useEffect(() => {
    const path = `communityVocab`;
    const vocabRef = collection(db, path);
    const q = query(vocabRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCommunityVocab(items);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    });

    return unsubscribe;
  }, []);

  // Seed lexicon to Firestore on mount
  useEffect(() => {
    seedLexiconToFirestore().catch(() => { /* non-critical */ });
  }, []);

  // Ensure we have a signed-in user before attempting writes to Firestore.
  // This handles races where the app triggers a write before the anonymous sign-in completes.
  const ensureSignedIn = async (): Promise<import('firebase/auth').User> => {
    if (auth.currentUser) return auth.currentUser;
    // No anonymous auth — prompt Google sign-in
    await login();
    if (auth.currentUser) return auth.currentUser;
    throw new Error('Please sign in to continue.');
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = () => signOut(auth);

  const addWord = async (word: string, translation: string, phonetic: string, isGlobal: boolean = false, audioBlob?: Blob) => {
    const effectiveUser = currentUser || (await ensureSignedIn());
    if (!effectiveUser) return;
    const path = isGlobal ? `communityVocab` : `users/${effectiveUser.uid}/personalVocab`;

    console.log('LanguageExplorer.addWord: about to write', { path, user: { uid: effectiveUser.uid, isAnonymous: effectiveUser.isAnonymous, email: effectiveUser.email } });

    try {
      let audioUrl: string | null = null;

      // Upload audio to Firebase Storage if provided
      if (audioBlob) {
        audioUrl = await uploadAudio(`vocab-audio/${Date.now()}-${translation}.webm`, audioBlob);
      }

      const newItem: any = {
        word,
        translation,
        phonetic,
        createdAt: serverTimestamp(),
        userId: currentUser?.uid,
        author: currentUser?.displayName,
        isGlobal
      };
      if (audioUrl) newItem.audioUrl = audioUrl;

      await addDoc(collection(db, path), newItem);
      setIsAddingWord(false);
    } catch (error) {
      console.error('LanguageExplorer.addWord failed', error);
      handleFirestoreError(error, OperationType.CREATE, isGlobal ? `communityVocab` : `users/${auth.currentUser?.uid}/personalVocab`);
    }
  };

  const updateWord = async (id: string, word: string, translation: string, phonetic: string, isGlobal: boolean = false, audioBlob?: Blob) => {
    try {
      const effectiveUser = currentUser || (await ensureSignedIn());
      if (!effectiveUser) return;
      const path = isGlobal ? `communityVocab/${id}` : `users/${effectiveUser.uid}/personalVocab/${id}`;
      console.log('LanguageExplorer.updateWord: about to write', { path, user: { uid: effectiveUser.uid, isAnonymous: effectiveUser.isAnonymous, email: effectiveUser.email } });

    try {
      const docRef = doc(db, path);
      const updateData: any = { word, translation, phonetic, updatedAt: serverTimestamp() };

      if (audioBlob) {
        const audioUrl = await uploadAudio(`vocab-audio/${Date.now()}-${translation}.webm`, audioBlob);
        updateData.audioUrl = audioUrl;
        // Immediately update the in-memory cache so playback works site-wide without waiting for Firestore roundtrip
        customAudioCache[translation.toLowerCase().trim()] = audioUrl;
      }

      const { setDoc } = await import('firebase/firestore');
      await setDoc(docRef, updateData, { merge: true });
    } catch (error) {
      console.error('LanguageExplorer.updateWord failed', error);
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, null);
    }
  };

  const updateCoreWord = async (originalId: string, word: string, translation: string, phonetic: string, audioBlob?: Blob) => {
    if (!isAdmin) throw new Error("You do not have admin permissions to edit core vocabulary.");
    await ensureSignedIn();
    try {
      const updateData: any = { word, translation, phonetic, updatedAt: serverTimestamp() };
      if (audioBlob) {
        const audioUrl = await uploadAudio(`vocab-audio/core-${Date.now()}-${originalId}.webm`, audioBlob);
        updateData.audioUrl = audioUrl;
        customAudioCache[translation.toLowerCase().trim()] = audioUrl;
        customAudioCache[originalId.toLowerCase().trim()] = audioUrl;
      }
      const { setDoc: firestoreSetDoc, doc: firestoreDoc, deleteDoc: firestoreDeleteDoc } = await import('firebase/firestore');

      // If the Edo word (translation) changed, we need to move the doc to the new ID
      if (originalId !== translation) {
        // Write to new doc ID
        const newDocRef = firestoreDoc(db, 'coreVocabAudio', translation);
        await firestoreSetDoc(newDocRef, updateData, { merge: true });
        // Delete old doc so it doesn't show as a duplicate
        const oldDocRef = firestoreDoc(db, 'coreVocabAudio', originalId);
        await firestoreDeleteDoc(oldDocRef);
      } else {
        // Same ID — just update in place
        const docRef = firestoreDoc(db, 'coreVocabAudio', originalId);
        await firestoreSetDoc(docRef, updateData, { merge: true });
      }
    } catch (error) {
      console.error('Failed to update core word', error);
      throw error;
    }
  };

  const deleteWord = async (id: string, isGlobal: boolean = false) => {
    try {
      const effectiveUser = currentUser || (await ensureSignedIn());
      if (!effectiveUser) return;
      const path = isGlobal ? `communityVocab/${id}` : `users/${effectiveUser.uid}/personalVocab/${id}`;
      console.log('LanguageExplorer.deleteWord: about to delete', { path, user: { uid: effectiveUser.uid, isAnonymous: effectiveUser.isAnonymous, email: effectiveUser.email } });
      await deleteDoc(doc(db, path));
    } catch (error) {
      console.error('LanguageExplorer.deleteWord failed', error);
      handleFirestoreError(error, OperationType.DELETE, isGlobal ? `communityVocab/${id}` : `users/${auth.currentUser?.uid}/personalVocab/${id}`);
    }
  };

  // Handle case for non-Edo languages or those without specific personas yet
  useEffect(() => {
    if (languageName.toLowerCase() !== 'edo' && EDO_PERSONAS.length > 0) {
      // For now, use generic characters if not Edo, 
      // in a production app these would be parsed from the language.lastSearchReport
    }
  }, [languageName]);

  useEffect(() => {
    const langRef = collection(db, 'languages');
    const q = query(langRef, where('name', '==', languageName));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setLanguage({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() });
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [languageName]);

  if (loading) return <div className="p-12 text-center text-[#5A5A40]">Accessing scrolls...</div>;
  if (!language) return <div className="p-12 text-center text-[#5A5A40]">Language not found.</div>;

  return (
    <div className="max-w-6xl mx-auto px-12 py-12">
      <div className="flex items-end justify-between mb-12">
        <header>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-[10px] py-1 px-3 border border-[#5A5A40] text-[#5A5A40] rounded-full font-bold uppercase tracking-widest">{language.location}</span>
          </div>
          <h1 className="text-6xl font-serif text-[#1A1A1A] tracking-tighter">
            {language.name} <span className="italic font-normal">Repository</span>
          </h1>
        </header>
        
        <div className="flex gap-4 mb-2">
          {currentUser ? (
            <div className="flex items-center gap-3 mr-2 px-4 py-2 bg-white border border-[#E5E5E5] rounded-full">
              <div className="w-6 h-6 rounded-full overflow-hidden border border-[#5A5A40]/20">
                <img src={currentUser.photoURL || ''} alt="" width={24} height={24} referrerPolicy="no-referrer" />
              </div>
              <span className="text-[10px] font-bold text-[#1A1A1A]">{currentUser.displayName}</span>
              <button 
                onClick={logout}
                className="p-1 text-[#A1A1A1] hover:text-[#A12D27] transition-colors"
                title="Sign Out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button 
              onClick={login}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-[#5A5A40]/30 text-[#5A5A40] rounded-full text-xs font-bold hover:bg-[#F5F5F0] transition-colors"
            >
              <LogIn size={14} />
              Sign in to Save
            </button>
          )}

          <div className="flex items-center gap-2 mr-4 bg-[#F5F5F0] p-1 rounded-full border border-[#E5E5E5]">
             <span className="text-[9px] uppercase tracking-widest font-bold px-3 text-[#5A5A40]">Voice: {selectedPersona.name}</span>
             <div className="flex gap-1">
               {EDO_PERSONAS.slice(0, 4).map((p) => (
                 <button 
                   key={p.name}
                   onClick={() => {
                     setSelectedPersona(p);
                     speak(`I am ${p.name}, ready to assist.`, p, false);
                   }}
                   className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${selectedPersona.name === p.name ? 'bg-[#5A5A40] text-white shadow-sm' : 'bg-white text-[#A1A1A1] hover:text-[#5A5A40]'}`}
                 >
                   {p.name[0]}
                 </button>
               ))}
             </div>
          </div>
          <button 
            onClick={() => speak(`Now reading the linguistic dossier for ${language.name}. ${language.lastSearchReport.replace(/[#*]/g, '')}`, selectedPersona, false)}
            className="flex items-center gap-2 px-4 py-2 bg-[#5A5A40] text-white rounded-full text-xs font-medium hover:bg-[#4A4A30] transition-colors shadow-sm"
          >
            <Volume2 size={16} />
            Listen to Dossier
          </button>
          <ActionButton icon={<Share2 />} />
          <ActionButton icon={<MessageSquare />} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-8 border-b border-[#E5E5E5] mb-12">
        <TabItem 
          active={activeSection === 'overview'} 
          onClick={() => setActiveSection('overview')} 
          label="Overview & History" 
          icon={<Scroll />} 
        />
        <TabItem 
          active={activeSection === 'dictionary'} 
          onClick={() => setActiveSection('dictionary')} 
          label="Lexicon & Dictionary" 
          icon={<Book />} 
        />
        <TabItem 
          active={activeSection === 'practice'} 
          onClick={() => setActiveSection('practice')} 
          label="Voice Lab" 
          icon={<Mic />} 
        />
        <TabItem 
          active={activeSection === 'assistant'} 
          onClick={() => setActiveSection('assistant')} 
          label="AI Assistant" 
          icon={<Sparkles />} 
        />
        <TabItem 
          active={activeSection === 'repository'} 
          onClick={() => setActiveSection('repository')} 
          label="Linguistic Repository" 
          icon={<Database />} 
        />
      </div>

      <AnimatePresence mode="wait">
        {activeSection === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid md:grid-cols-2 gap-12"
          >
            <div className="prose prose-stone prose-lg max-w-none prose-headings:font-serif">
               <div className="bg-white p-8 rounded-[40px] border border-[#E5E5E5] shadow-sm">
                 <ReactMarkdown>{language.lastSearchReport}</ReactMarkdown>
               </div>
            </div>
            
            <div className="space-y-8">
              <div className="bg-[#1A1A1A] text-white p-10 rounded-[40px] relative overflow-hidden">
                <Map className="absolute top-8 right-8 w-16 h-16 opacity-10" />
                <h3 className="text-[10px] uppercase tracking-widest mb-6 opacity-60 font-bold">Location Profile</h3>
                <p className="text-2xl font-serif mb-4 leading-snug">{language.location}</p>
                <div className="h-[2px] w-12 bg-white/20 mb-6" />
                <p className="text-sm opacity-80 leading-relaxed">This territory represents the cultural cradle where {language.name} has breathed for centuries.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <StatBox label="Learned Words" value="0" />
                <StatBox label="Mastery Level" value="Beginner" />
              </div>

              {language.sources && (
                <div className="p-8 rounded-[40px] border border-[#E5E5E5]">
                  <h4 className="text-[10px] uppercase tracking-widest mb-4 font-bold">Citations & Archives</h4>
                  <div className="space-y-4">
                    {language.sources.map((s: any, i: number) => (
                      <a key={i} href={s.web?.uri} target="_blank" rel="noreferrer" className="flex items-center gap-3 text-sm text-[#5A5A40] hover:text-[#1A1A1A] group">
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                        <span className="truncate">{s.web?.title || 'Archive Link'}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-8 rounded-[40px] bg-[#F5F5F0] border border-[#E5E5E5]">
                <h4 className="text-[10px] uppercase tracking-widest mb-6 font-bold text-[#5A5A40]">Advanced Grammar Lab</h4>
                <div className="space-y-6">
                  <div>
                    <p className="text-[10px] font-bold text-[#A1A1A1] uppercase mb-1">Emphasis (Focus Marker)</p>
                    <p className="text-sm font-medium mb-1">Edo uses <strong>ọre</strong> to focus an element.</p>
                    <p className="text-xs italic text-[#5A5A40]">"Ize ọre ọ rrie owa" - It is Ize who went home.</p>
                  </div>
                  <div className="h-[1px] bg-[#E5E5E5]" />
                  <div>
                    <p className="text-[10px] font-bold text-[#A1A1A1] uppercase mb-1">Interrogative Sentence Structure</p>
                    <p className="text-sm font-medium mb-1">Focus often pairs with questions.</p>
                    <p className="text-xs italic text-[#5A5A40]">"Vbọ ọre u dẹ?" - What (is it that) you bought?</p>
                  </div>
                  <div className="h-[1px] bg-[#E5E5E5]" />
                  <div>
                    <p className="text-[10px] font-bold text-[#A1A1A1] uppercase mb-1">Serial Verb Constructions (SVC)</p>
                    <p className="text-sm font-medium mb-1">Multiple verbs describing one event.</p>
                    <p className="text-xs italic text-[#5A5A40]">"Ọ gbe ẹmọ khiẹn" - He killed and sold the cow.</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'dictionary' && (
          <motion.div
            key="dictionary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
            <div className="bg-[#F5F5F0] p-12 rounded-[40px]">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-serif mb-2">Lexical Dictionary</h3>
                  <p className="text-sm text-[#5A5A40]">Foundational and personal vocabulary for {language.name}.</p>
                </div>
                <div className="flex gap-2">
                  {isAdmin && (
                    <button 
                      onClick={() => setIsAddingWord(!isAddingWord)}
                      className="flex items-center gap-2 px-6 py-3 bg-[#5A5A40] text-white rounded-full text-xs font-bold hover:bg-[#4A4A30] transition-all shadow-md active:scale-95"
                    >
                      <Sparkles size={16} />
                      Admin: Add to Global
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      if (!currentUser) login();
                      else setIsAddingWord(!isAddingWord);
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-[#1A1A1A] text-white rounded-full text-xs font-bold hover:bg-[#333] transition-all shadow-md active:scale-95"
                  >
                    {!currentUser ? <LogIn size={16} /> : (isAddingWord ? <X size={16} /> : <Play size={16} className="rotate-90" />)}
                    {!currentUser ? 'Sign in to Add' : (isAddingWord ? 'Cancel' : 'Personal Word')}
                  </button>
                  <Languages className="w-8 h-8 text-[#5A5A40] opacity-40 ml-4" />
                </div>
              </div>

              {isAddingWord && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-8 overflow-hidden"
                >
                  <AddWordForm 
                    onAdd={(w, t, p, blob) => addWord(w, t, p, isAdmin, blob)} 
                    onCancel={() => setIsAddingWord(false)} 
                    isAdmin={isAdmin}
                  />
                </motion.div>
              )}
              
              {/* Personal Vocabulary */}
              {currentUser ? (
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  {personalVocab.map((item) => (
                    <VocabularyItem
                      key={item.id}
                      id={item.id}
                      word={item.word}
                      translation={item.translation}
                      phonetic={item.phonetic}
                      audioUrl={item.audioUrl}
                      persona={selectedPersona}
                      onDelete={() => deleteWord(item.id)}
                      onUpdate={(w, t, p, blob) => updateWord(item.id, w, t, p, false, blob)}
                      isPersonal
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-white/50 border border-dashed border-[#D5D5C5] rounded-3xl text-center mb-6">
                  <p className="text-sm text-[#5A5A40] italic">Sign in to add and save your own words to the Edo Lexicon.</p>
                </div>
              )}

              {/* Core Vocabulary from useLexicon */}
              {lexiconLoading ? (
                <div className="text-center py-8 text-[#5A5A40]">Loading lexicon...</div>
              ) : (
                <div className="space-y-10">
                  {lexiconCategories.map((cat) => (
                    <div key={cat.category}>
                      <div className="flex items-center gap-3 mb-4">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-[#5A5A40]">{cat.category}</h4>
                        <span className="text-[10px] bg-[#5A5A40]/10 text-[#5A5A40] px-2 py-0.5 rounded-full font-bold">{cat.entries.length}</span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {cat.entries.map((entry) => (
                          <VocabularyItem
                            key={entry.id}
                            word={entry.english}
                            translation={entry.edoWord}
                            phonetic={entry.phonetic}
                            audioUrl={entry.audioUrl}
                            persona={selectedPersona}
                            isAdmin={isAdmin}
                            onUpdate={(w, t, p, blob) => updateCoreWord(entry.id, w, t, p, blob)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeSection === 'practice' && (
            <motion.div
              key="practice"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-4xl mx-auto py-12"
            >
              <div className="grid lg:grid-cols-2 gap-12 items-start">
                <div className="text-center bg-[#F5F5F0] p-12 rounded-[40px] border border-[#E5E5E5]">
                  <div className="mb-8 relative inline-block">
                    <div className="w-32 h-32 bg-[#5A5A40] rounded-full flex items-center justify-center text-white shadow-2xl relative z-10 mx-auto cursor-pointer hover:scale-105 transition-transform group">
                      <Mic className="w-10 h-10 group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="absolute inset-0 bg-[#5A5A40]/10 rounded-full animate-ping" />
                  </div>
                  <h3 className="text-3xl font-serif mb-4 text-[#1A1A1A]">Voice Lab</h3>
                  <p className="text-[#5A5A40] text-sm leading-relaxed mb-8">
                    Calibrate your phonetics. Speak directly into the mic to compare your resonance against AI Edo models.
                  </p>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => speak(`Welcome to the voice training for ${language.name}`, selectedPersona)}
                      className="w-full py-4 bg-[#1A1A1A] text-white rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-black transition-all"
                    >
                      Initialize Lab
                    </button>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => playEdoSpeech("Vbẹe oye hẹ?")}
                        className="flex-1 py-4 border border-[#5A5A40]/20 text-[#5A5A40] rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all flex items-center justify-center gap-2"
                      >
                        <Volume2 size={14} /> Sample
                      </button>
                      <button 
                         className="flex-1 py-4 border border-[#5A5A40]/20 text-[#5A5A40] rounded-2xl text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all"
                      >
                        Settings
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                   <h4 className="text-[10px] uppercase tracking-widest font-bold text-[#A1A1A1] pl-2">Conversational Drills</h4>
                   <div className="space-y-3">
                      {[
                        { edo: "Vbẹe u rrie hẹ?", en: "Where are you going?" },
                        { edo: "I rrie owa", en: "I am going home" },
                        { edo: "Vbọ ọre u dẹ?", en: "What did you buy?" },
                        { edo: "Uru ese", en: "Thank you" }
                      ].map((drill, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-3xl border border-[#E5E5E5] flex items-center justify-between group hover:border-[#5A5A40] transition-colors">
                          <div>
                            <p className="text-lg font-serif mb-1">{drill.edo}</p>
                            <p className="text-[10px] text-[#A1A1A1] font-bold uppercase">{drill.en}</p>
                          </div>
                          <div className="flex gap-2">
                             <button 
                               onClick={() => playEdoSpeech(drill.edo)}
                               className="p-3 bg-[#F5F5F0] text-[#5A5A40] rounded-full hover:bg-[#5A5A40] hover:text-white transition-all"
                             >
                               <Volume2 size={16} />
                             </button>
                             <button className="p-3 bg-[#1A1A1A] text-white rounded-full hover:bg-black transition-all scale-90 group-hover:scale-100">
                               <Mic size={16} />
                             </button>
                          </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              {/* Cultural Resources Section */}
              <div className="mt-20 pt-12 border-t border-[#E5E5E5]">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-[#5A5A40]/10 rounded-lg text-[#5A5A40]">
                    <Database size={20} />
                  </div>
                  <h4 className="text-xl font-serif">Cultural Audio Archives</h4>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <a 
                    href="https://www.divinerevelations.info/documents/bible/edo_mp3_bible/edo_bsn_nt_drama/?dir=_chapters_" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="p-6 bg-[#F5F5F0] rounded-3xl border border-transparent hover:border-[#5A5A40] transition-all group"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] uppercase tracking-widest font-bold text-[#5A5A40]">Primary Audio Source</span>
                      <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                    <h5 className="text-lg font-serif mb-2">Edo MP3 Audio Bible</h5>
                    <p className="text-[#A1A1A1] text-xs leading-relaxed">
                      A comprehensive dramatic recording of the New Testament in Bini. Ideal for understanding natural cadence, tone, and pronunciation of complex Edo sentences.
                    </p>
                  </a>

                  <div className="p-6 bg-white rounded-3xl border border-[#E5E5E5]">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-[#A1A1A1] inline-block mb-4">AI Integration note</span>
                    <h5 className="text-lg font-serif mb-2">Linguistic Training</h5>
                    <p className="text-[#A1A1A1] text-xs leading-relaxed">
                      This application uses AI voices trained on linguistic patterns found in archival recordings like the Edo Bible to ensure phonetic fidelity.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
        )}

        {activeSection === 'assistant' && (
            <motion.div
              key="assistant"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <EdoAssistant user={currentUser!} isAdmin={isAdmin} />
            </motion.div>
        )}

        {activeSection === 'repository' && (
            <motion.div
              key="repository"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-12 pb-20"
            >
              <div className="bg-[#1A1A1A] text-white p-12 rounded-[40px] relative overflow-hidden">
                <Database className="absolute top-12 right-12 w-24 h-24 opacity-10" />
                <h3 className="text-[10px] uppercase tracking-widest mb-6 opacity-60 font-bold">Linguistic Dossier</h3>
                <h2 className="text-4xl font-serif mb-4 leading-tight">Master Record of Edo <br/><span className="italic font-normal">Language & Culture</span></h2>
                <p className="text-sm opacity-80 max-w-xl leading-relaxed">This repository serves as the definitive record of the research, translations, and pedagogical materials generated during our collaboration. It is directly used to ground the AI's understanding of modern Bini.</p>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {/* Community Submissions */}
                {communityVocab.length > 0 && (
                   <div className="bg-[#1A1A1A] p-8 rounded-[40px] border border-[#E5E5E5] shadow-xl md:col-span-2">
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-yellow-500/20 rounded-xl text-yellow-500">
                            <Sparkles size={20} />
                          </div>
                          <div>
                            <h4 className="text-lg font-serif text-white">Community Contributions</h4>
                            <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold">Linguistic field additions</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-white bg-white/10 px-3 py-1 rounded-full uppercase tracking-tighter">{communityVocab.length} Entries</span>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        {communityVocab.map((item, i) => (
                          <VocabularyItem 
                             key={item.id}
                             id={item.id}
                             word={item.word}
                             translation={item.translation}
                             phonetic={item.phonetic}
                             persona={selectedPersona}
                             onUpdate={(w, t, p, blob) => updateWord(item.id, w, t, p, true, blob)}
                             isPersonal={isAdmin || item.userId === currentUser?.uid}
                             onDelete={isAdmin || item.userId === currentUser?.uid ? () => deleteWord(item.id, true) : undefined}
                             isAdmin={isAdmin}
                          />
                        ))}
                      </div>
                   </div>
                )}

                {LINGUISTIC_REPOSITORY.map((cat, idx) => (
                  <div key={idx} className="bg-white p-8 rounded-[40px] border border-[#E5E5E5] shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                      <h4 className="text-lg font-serif">{cat.category}</h4>
                      <span className="text-[10px] font-bold text-[#5A5A40] bg-[#F5F5F0] px-3 py-1 rounded-full uppercase tracking-tighter">{cat.items.length} Entries</span>
                    </div>
                    <div className="space-y-3">
                      {cat.items.map((item, i) => (
                        <VocabularyItem 
                           key={i} 
                           word={item.term} 
                           translation={item.translation} 
                           phonetic={item.phonetic} 
                           persona={selectedPersona} 
                           onPublish={isAdmin ? (w, t, p) => addWord(w, t, p, true) : undefined}
                           isAdmin={isAdmin}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabItem({ active, onClick, label, icon }: { active: boolean, onClick: () => void, label: string, icon: React.ReactElement }) {
  return (
    <button
      onClick={onClick}
      className={`pb-4 flex items-center gap-2 text-sm transition-all relative ${
        active ? 'text-[#1A1A1A] font-bold' : 'text-[#A1A1A1] hover:text-[#5A5A40]'
      }`}
    >
      {React.cloneElement(icon, { size: 16 } as any)}
      {label}
      {active && <motion.div layoutId="tab" className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#1A1A1A]" />}
    </button>
  );
}

function StatBox({ label, value }: { label: string, value: string }) {
  return (
    <div className="p-6 rounded-[32px] bg-white border border-[#E5E5E5] flex flex-col justify-between h-32">
      <span className="text-[10px] uppercase tracking-widest font-bold text-[#5A5A40]">{label}</span>
      <span className="text-3xl font-serif">{value}</span>
    </div>
  );
}

function VocabularyItem({
  id, word, translation, phonetic: defaultPhonetic, audioUrl: initialAudioUrl,
  persona, onDelete, isPersonal, onUpdate, onPublish, isAdmin
}: {
  id?: string;
  word: string;
  translation: string;
  phonetic: string;
  audioUrl?: string;
  persona: VoicePersona;
  onDelete?: () => void;
  isPersonal?: boolean;
  onUpdate?: (w: string, t: string, p: string, audioBlob?: Blob) => Promise<void>;
  onPublish?: (w: string, t: string, p: string) => void;
  isAdmin?: boolean;
}) {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'success' | 'fail'>('idle');
  const [feedback, setFeedback] = useState<string>('');
  const [activeRecognition, setActiveRecognition] = useState<{ stop: () => void } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const recorderRef = React.useRef<{ stop: () => void } | null>(null);

  const [customPhonetic, setCustomPhonetic] = useState<string>(() => {
    const saved = localStorage.getItem(`phonetic_${translation}`);
    return saved || defaultPhonetic;
  });

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editValue, setEditValue] = useState(customPhonetic);
  const [editWord, setEditWord] = useState(word);
  const [editTranslation, setEditTranslation] = useState(translation);

  useEffect(() => {
    setEditWord(word);
    setEditTranslation(translation);
  }, [word, translation]);

  // Admin audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(initialAudioUrl ?? null);
  const timerRef = React.useRef<any>(null);

  // Always sync local preview from Firestore — whether it was just saved or externally updated
  useEffect(() => {
    setAudioPreviewUrl(initialAudioUrl ?? null);
  }, [initialAudioUrl]);

  const startAdminRecording = async () => {
    try {
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
    } catch (err) {
      console.error('Admin recording failed', err);
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const stopAdminRecording = () => {
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

  const playAudio = () => {
    if (audioPreviewUrl) new Audio(audioPreviewUrl).play();
    else playEdoSpeech(translation);
  };

  const handlePractice = async () => {
    try {
      setFeedback('');
      const recognition = recordSpeech((s) => {
        setStatus(current => {
          if (current === 'success' || current === 'fail') return current;
          if (s === 'done') return current === 'listening' ? 'processing' : current;
          if (s === 'listening') return 'listening';
          if (s === 'processing') return 'processing';
          if (s === 'error') return 'fail';
          return current;
        });
      });
      setActiveRecognition(recognition);
      const transcript = await recognition.promise;
      setActiveRecognition(null);
      const normalizedTarget = translation.toLowerCase().replace(/[ọẹ]/g, m => m === 'ọ' ? 'o' : 'e');
      const isMatch = transcript.toLowerCase().includes(normalizedTarget) || normalizedTarget.includes(transcript.toLowerCase());
      setStatus(isMatch ? 'success' : 'fail');
      setFeedback(isMatch ? 'Excellent pronunciation!' : `Heard: "${transcript}"`);
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      setActiveRecognition(null);
      setStatus('fail');
      setFeedback(error === 'No speech detected' ? 'Silence detected' : 'Retry speaking');
      setTimeout(() => setStatus('idle'), 2000);
    }
  };

  const handleStop = () => {
    if (activeRecognition) {
      activeRecognition.stop();
      setActiveRecognition(null);
      setStatus('idle');
      setFeedback('Stopped');
      setTimeout(() => setFeedback(''), 2000);
    }
  };

  const saveCorrection = async () => {
    setIsSaving(true);
    try {
      setCustomPhonetic(editValue);
      localStorage.setItem(`phonetic_${editTranslation}`, editValue);
      if (onUpdate) {
        await onUpdate(editWord, editTranslation, editValue, audioBlob ?? undefined);
        setAudioBlob(null);
      }
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving correction:", error);
      alert("Failed to save changes: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsSaving(false);
    }
  };

  const isWorking = status === 'listening' || status === 'processing';

  return (
    <div className={`flex flex-col p-6 bg-white rounded-3xl border transition-all relative group ${
      status === 'listening' ? 'border-[#5A5A40] ring-4 ring-[#5A5A40]/10' :
      status === 'success' ? 'border-[#2D5A27] bg-[#F0F5F0]' :
      status === 'fail' ? 'border-[#A12D27] bg-[#F5F0F0]' :
      'border-[#E5E5E5] hover:border-[#5A5A40]'
    }`}>
      {isPersonal && (
        <button onClick={onDelete} className="absolute -top-2 -right-2 w-7 h-7 bg-[#A12D27] text-white rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-all z-10" title="Remove">
          <X size={14} />
        </button>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-widest font-bold text-[#A1A1A1]">{word}</span>
            {isPersonal && <span className="text-[8px] bg-[#5A5A40] text-white px-2 py-0.5 rounded-full uppercase">Self-Added</span>}
            {audioPreviewUrl && <span className="text-[8px] bg-blue-500 text-white px-2 py-0.5 rounded-full uppercase flex items-center gap-1"><Mic size={8} /> Audio</span>}
          </div>

          {isEditing ? (
            <div className="mt-3 p-4 bg-[#F8F8F5] rounded-2xl border border-[#D5D5C5] space-y-4">
              {/* Header */}
              <div className="flex items-center gap-2 pb-2 border-b border-[#E5E5E5]">
                <Edit2 size={12} className="text-[#5A5A40]" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#5A5A40]">
                  {isAdmin ? 'Admin Editor — All fields are fully editable' : 'Edit Entry'}
                </span>
              </div>

              {/* English meaning */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-[#A1A1A1] block mb-1">English Meaning</label>
                <input
                  disabled={isSaving}
                  value={editWord}
                  onChange={e => setEditWord(e.target.value)}
                  className="w-full text-sm border border-[#E5E5E5] rounded-xl px-3 py-2 outline-none focus:border-[#5A5A40] focus:ring-2 focus:ring-[#5A5A40]/10 bg-white disabled:opacity-50 transition-all"
                  placeholder="e.g. Good morning"
                />
              </div>

              {/* Edo word */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-[#A1A1A1] block mb-1">Edo Word / Phrase <span className="text-[#5A5A40]">(replaces existing)</span></label>
                <input
                  disabled={isSaving}
                  value={editTranslation}
                  onChange={e => setEditTranslation(e.target.value)}
                  className="w-full text-lg font-serif border border-[#5A5A40]/30 rounded-xl px-3 py-2 outline-none focus:border-[#5A5A40] focus:ring-2 focus:ring-[#5A5A40]/10 bg-white disabled:opacity-50 transition-all"
                  placeholder="e.g. Obowie"
                />
              </div>

              {/* Phonetic */}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-widest text-[#A1A1A1] block mb-1">Phonetic Pronunciation Guide <span className="text-[#5A5A40]">(replaces existing)</span></label>
                <input
                  disabled={isSaving}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  className="w-full text-sm italic border border-[#E5E5E5] rounded-xl px-3 py-2 outline-none focus:border-[#5A5A40] focus:ring-2 focus:ring-[#5A5A40]/10 bg-white disabled:opacity-50 transition-all text-[#5A5A40]"
                  placeholder="e.g. /Oh-bo-wee-eh/"
                />
              </div>

              {/* Admin audio panel */}
              {isAdmin && (
                <div className="p-3 bg-white rounded-xl border border-[#E5E5E5] space-y-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-[#5A5A40] block">
                    🎙 Record Audio Pronunciation <span className="text-[#A1A1A1] font-normal">(replaces existing audio)</span>
                  </span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button type="button" onClick={isRecording ? stopAdminRecording : startAdminRecording}
                      disabled={isSaving}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-[#5A5A40] text-white hover:bg-[#4A4A30]'} disabled:opacity-50`}>
                      {isRecording ? <Square size={10} fill="currentColor" /> : <Mic size={10} />}
                      {isRecording ? `Stop (${recordingSeconds}s)` : 'Record'}
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="audio/*" className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-[#F5F5F0] text-[#5A5A40] border border-[#E5E5E5] hover:border-[#5A5A40] transition-all disabled:opacity-50">
                      <Upload size={10} /> Upload File
                    </button>
                    {audioPreviewUrl && (
                      <>
                        <button type="button" onClick={() => new Audio(audioPreviewUrl).play()}
                          disabled={isSaving}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all disabled:opacity-50">
                          <Play size={10} fill="currentColor" /> Preview
                        </button>
                        <button type="button" onClick={() => { setAudioBlob(null); setAudioPreviewUrl(null); }}
                          disabled={isSaving}
                          className="p-1.5 text-[#A1A1A1] hover:text-red-500 transition-colors disabled:opacity-50" title="Clear audio">
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                  {isRecording && <p className="text-[9px] text-red-500 font-bold animate-pulse uppercase">● Recording... speak clearly, then press Stop</p>}
                  {audioBlob && !isRecording && <p className="text-[9px] text-green-600 font-bold uppercase">✓ New audio ready — will replace existing audio on Update</p>}
                  {!audioBlob && audioPreviewUrl && <p className="text-[9px] text-blue-500 font-bold uppercase">ℹ Existing audio saved — record new audio above to replace it</p>}
                </div>
              )}

              {/* Save / Cancel */}
              <div className="flex gap-2 pt-1 border-t border-[#E5E5E5]">
                <button
                  onClick={saveCorrection}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white bg-[#1A1A1A] px-4 py-2 rounded-full hover:bg-black transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-1 justify-center"
                >
                  <Check size={11} /> {isSaving ? 'Saving changes...' : (onUpdate ? '✓ Update & Replace' : 'Apply Changes')}
                </button>
                <button onClick={() => { setIsEditing(false); setAudioBlob(null); setAudioPreviewUrl(initialAudioUrl ?? null); }} className="text-[10px] font-bold uppercase tracking-widest text-[#A1A1A1] px-4 py-2 border border-[#E5E5E5] rounded-full hover:bg-gray-50 transition-all">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h5 className="text-xl font-serif text-[#1A1A1A]">{translation}</h5>
                {(isAdmin || onUpdate) && (
                  <button onClick={() => { setIsEditing(true); setEditWord(word); setEditTranslation(translation); setEditValue(customPhonetic); }}
                    className="p-1 text-[#A1A1A1] hover:text-[#5A5A40] transition-colors" title="Edit / Record pronunciation">
                    <Edit2 size={12} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-[10px] text-[#A1A1A1] italic">/{customPhonetic}/</span>
                {onPublish && isAdmin && (
                  <button onClick={() => onPublish(word, translation, customPhonetic)}
                    className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-[#5A5A40] bg-[#5A5A40]/10 px-2.5 py-1 rounded-full hover:bg-[#5A5A40] hover:text-white transition-all">
                    <Sparkles size={10} /> Publish
                  </button>
                )}
                {feedback && (
                  <span className={`text-[9px] font-bold uppercase tracking-tight ${status === 'success' ? 'text-[#2D5A27]' : 'text-[#A12D27]'}`}>{feedback}</span>
                )}
              </div>
            </>
          )}
        </div>

        {!isEditing && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={playAudio} disabled={isWorking}
              className="p-3 bg-[#F5F5F0] text-[#5A5A40] rounded-full hover:bg-[#5A5A40] hover:text-white transition-all shadow-sm disabled:opacity-30 relative"
              title={audioPreviewUrl ? 'Play recorded audio' : 'Listen (TTS)'}>
              <Volume2 size={18} />
              {audioPreviewUrl && <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white" />}
            </button>

            {status === 'listening' ? (
              <button onClick={handleStop} className="px-4 py-3 bg-[#1A1A1A] text-white rounded-full transition-all shadow-lg hover:bg-black flex items-center gap-2 animate-pulse">
                <Square size={14} fill="currentColor" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Stop</span>
              </button>
            ) : (
              <button onClick={handlePractice} disabled={status === 'processing'}
                className={`p-3 rounded-full transition-all shadow-sm flex items-center justify-center min-w-[44px] ${
                  status === 'processing' ? 'bg-[#5A5A40] text-white' :
                  status === 'success' ? 'bg-[#2D5A27] text-white' :
                  status === 'fail' ? 'bg-[#A12D27] text-white' :
                  'bg-[#1A1A1A] text-white hover:bg-[#333]'
                }`} title="Practice pronunciation">
                {status === 'processing' ? <Loader2 size={18} className="animate-spin" /> :
                  status === 'success' ? <CheckCircle2 size={18} /> :
                  status === 'fail' ? <XCircle size={18} /> :
                  <Mic size={18} />}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
function ActionButton({ icon }: { icon: React.ReactElement }) {
  return (
    <button className="p-4 bg-white border border-[#E5E5E5] rounded-full text-[#5A5A40] hover:bg-[#F5F5F0] transition-colors">
      {React.cloneElement(icon, { size: 20 } as any)}
    </button>
  );
}

function AddWordForm({ onAdd, onCancel, isAdmin }: { onAdd: (w: string, t: string, ph: string, audioBlob?: Blob) => void, onCancel: () => void, isAdmin?: boolean }) {
  const [word, setWord] = useState('');
  const [translation, setTranslation] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const recorderRef = React.useRef<{ stop: () => void } | null>(null);
  const timerRef = React.useRef<any>(null);

  const startVoiceEntry = async () => {
    try {
      setIsRecording(true);
      setRecordingSeconds(0);
      setAudioPreviewUrl(null);
      setAudioBlob(null);

      // Tick counter so user sees elapsed time
      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000);

      const recorder = recordAudioBlob((status) => {
        if (status === 'error' || status === 'done') {
          setIsRecording(false);
          clearInterval(timerRef.current);
        }
      });
      recorderRef.current = recorder;

      const { blob } = await recorder.promise;
      setIsRecording(false);
      clearInterval(timerRef.current);
      recorderRef.current = null;

      // Store blob and create preview — admin types the word manually
      setAudioBlob(blob);
      setAudioPreviewUrl(URL.createObjectURL(blob));
    } catch (error) {
      console.error("Voice entry failed", error);
      setIsRecording(false);
      clearInterval(timerRef.current);
    }
  };

  const stopVoiceEntry = () => {
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

  const clearAudio = () => {
    setAudioPreviewUrl(null);
    setAudioBlob(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (word && translation) {
      onAdd(word, translation, phonetic || translation, audioBlob ?? undefined);
      setWord('');
      setTranslation('');
      setPhonetic('');
      clearAudio();
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`p-8 rounded-3xl border shadow-inner mb-6 transition-colors ${isAdmin ? 'bg-[#1A1A1A] border-[#333]' : 'bg-white border-[#D5D5C5]'}`}>
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl ${isAdmin ? 'bg-yellow-500/20 text-yellow-500' : 'bg-[#5A5A40]/10 text-[#5A5A40]'}`}>
            {isAdmin ? <Sparkles size={18} /> : <FileAudio size={18} />}
          </div>
          <div>
            <h4 className={`text-lg font-serif ${isAdmin ? 'text-white' : 'text-[#1A1A1A]'}`}>
              {isAdmin ? 'Master Entry Contribution' : 'New Vocabulary Entry'}
            </h4>
            <p className={`text-[10px] uppercase tracking-widest font-bold ${isAdmin ? 'text-white/40' : 'text-[#A1A1A1]'}`}>
              {isAdmin ? 'Global Repository Access' : 'Personal Collection'}
            </p>
          </div>
        </div>
        
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="audio/*"
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            isAdmin ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-[#F5F5F0] text-[#5A5A40] hover:bg-[#E5E5D5]'
          }`}
        >
          <Upload size={14} />
          Upload Reference
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className={`text-[10px] uppercase tracking-widest font-bold mb-2 block ${isAdmin ? 'text-white/60' : 'text-[#A1A1A1]'}`}>English Meaning</label>
            <input 
              type="text" 
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder="e.g. Bread"
              className={`w-full border rounded-xl px-4 py-3 text-sm transition-colors focus:outline-none focus:ring-2 ${
                isAdmin ? 'bg-[#2A2A2A] border-[#3A3A3A] text-white placeholder-[#666] focus:ring-yellow-500 focus:border-yellow-500' : 'bg-[#F5F5F0] border-[#E5E5E5] text-black focus:ring-[#5A5A40] focus:border-[#5A5A40]'
              }`}
              required
            />
          </div>
          <div>
            <label className={`text-[10px] uppercase tracking-widest font-bold mb-2 block ${isAdmin ? 'text-white/60' : 'text-[#A1A1A1]'}`}>Phonetic (AI Guide)</label>
            <input 
              type="text" 
              value={phonetic}
              onChange={(e) => setPhonetic(e.target.value)}
              placeholder="e.g. Eh-booo-ray-dee"
              className={`w-full border rounded-xl px-4 py-3 text-sm transition-colors focus:outline-none focus:ring-2 ${
                isAdmin ? 'bg-[#2A2A2A] border-[#3A3A3A] text-white placeholder-[#666] focus:ring-yellow-500 focus:border-yellow-500' : 'bg-[#F5F5F0] border-[#E5E5E5] text-black focus:ring-[#5A5A40] focus:border-[#5A5A40]'
              }`}
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className={`text-[10px] uppercase tracking-widest font-bold mb-2 block ${isAdmin ? 'text-white/60' : 'text-[#A1A1A1]'}`}>Edo Word</label>
          <input 
            type="text" 
            value={translation}
            onChange={(e) => setTranslation(e.target.value)}
            placeholder="e.g. Eburendi"
            className={`w-full border rounded-xl px-4 py-6 text-xl font-serif transition-colors focus:outline-none focus:ring-2 ${
              isAdmin ? 'bg-[#2A2A2A] border-[#3A3A3A] text-white placeholder-[#666] focus:ring-yellow-500 focus:border-yellow-500' : 'bg-[#F5F5F0] border-[#E5E5E5] text-black focus:ring-[#5A5A40] focus:border-[#5A5A40]'
            }`}
            required
          />
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {audioPreviewUrl && (
                <div className={`flex items-center gap-2 p-1.5 rounded-2xl border ${isAdmin ? 'bg-white/5 border-white/10' : 'bg-[#F5F5F0] border-[#D5D5C5]'}`}>
                  <button
                    type="button"
                    onClick={() => {
                        const audio = new Audio(audioPreviewUrl);
                        audio.play();
                    }}
                    className="p-3 bg-blue-500 text-white rounded-full hover:bg-blue-400 transition-all shadow-md group"
                    title="Play recorded sample"
                  >
                    <Play size={16} fill="currentColor" className="group-active:scale-90 transition-transform" />
                  </button>
                  <div className="px-2">
                    <p className={`text-[9px] font-bold uppercase tracking-tighter ${isAdmin ? 'text-white/60' : 'text-[#5A5A40]'}`}>Audio Captured</p>
                    <p className={`text-[8px] ${isAdmin ? 'text-white/30' : 'text-[#A1A1A1]'}`}>Type the Edo word above</p>
                  </div>
                  <button
                    type="button"
                    onClick={clearAudio}
                    className={`p-3 transition-all rounded-full ${isAdmin ? 'hover:bg-red-500/10 text-white/30 hover:text-red-500' : 'hover:bg-red-50 text-[#A1A1A1] hover:text-red-500'}`}
                    title="Clear recording"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={isRecording ? stopVoiceEntry : startVoiceEntry}
                className={`flex items-center gap-3 px-6 py-4 rounded-full transition-all shadow-lg ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse scale-105' 
                    : (isAdmin ? 'bg-white text-black hover:bg-yellow-500' : 'bg-[#1A1A1A] text-white hover:bg-[#333]')
                }`}
                title={isRecording ? 'Stop recording' : 'Record Edo word'}
              >
                {isRecording ? <Square size={18} fill="currentColor" /> : <Mic size={18} />}
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  {isRecording ? `Stop (${recordingSeconds}s)` : 'Voice Capture'}
                </span>
              </button>
            </div>
          </div>

          {isRecording && (
            <p className="text-[10px] font-bold text-red-500 animate-pulse uppercase tracking-widest">
              Recording word ({recordingSeconds}s)... press Stop when done
            </p>
          )}
          {audioPreviewUrl && !isRecording && (
            <p className="text-[10px] font-bold text-green-500 uppercase tracking-widest">
              ✓ Audio saved — now type the Edo word and phonetic above
            </p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
        <button 
          type="button" 
          onClick={onCancel}
          className={`px-6 py-2 text-xs font-bold transition-all ${isAdmin ? 'text-white/40 hover:text-white' : 'text-[#A1A1A1] hover:text-[#1A1A1A]'}`}
        >
          Cancel
        </button>
        <button 
          type="submit"
          className={`px-10 py-3 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
            isAdmin ? 'bg-yellow-500 text-black hover:bg-yellow-400' : 'bg-[#1A1A1A] text-white hover:bg-black'
          }`}
        >
          {isAdmin ? 'Publish to Repository' : 'Save to My Dictionary'}
        </button>
      </div>
    </form>
  );
}
