import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User, signInAnonymously } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, signIn, db } from './lib/firebase';
import { Globe, BookOpen, Brain, Languages, LogOut, Database, MessageSquare, GraduationCap, Users, Key, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import SearchLanguage from './components/SearchLanguage';
import LanguageExplorer from './components/LanguageExplorer';
import AdminRepository from './components/AdminRepository';
import EdoAssistant from './components/EdoAssistant';
import AdminTraining from './components/AdminTraining';
import TeamManagement from './components/TeamManagement';

const ADMIN_EMAIL = 'mckpedersen@gmail.com';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [developerUser, setDeveloperUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'assistant' | 'discover' | 'explorer' | 'repository' | 'training' | 'team'>(() => {
    return (localStorage.getItem('active_tab') as any) || 'assistant';
  });
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(() => {
    return localStorage.getItem('selected_language') || null;
  });

  // Developer Login State
  const [showDeveloperLogin, setShowDeveloperLogin] = useState(false);
  const [devUsername, setDevUsername] = useState('');
  const [devPin, setDevPin] = useState('');
  const [devLoginError, setDevLoginError] = useState('');

  const isMasterAdmin = user?.email === ADMIN_EMAIL;
  const isDeveloper = !!developerUser;
  const isAdmin = isMasterAdmin || isDeveloper;

  useEffect(() => {
    // Check local storage for persistent dev login
    const savedDev = localStorage.getItem('lexicon_dev_user');
    if (savedDev) {
      setDeveloperUser(JSON.parse(savedDev));
    }

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u && !u.isAnonymous) {
        // Real Google user — clear any dev session
        setDeveloperUser(null);
        localStorage.removeItem('lexicon_dev_user');
      }
      if (!u) {
        // No user — try anonymous sign-in so Firestore writes have auth.
        // If it fails or is disabled, still unblock the loading screen.
        try {
          await signInAnonymously(auth);
          // onAuthStateChanged will fire again with the anonymous user — return here
          return;
        } catch (err) {
          console.warn('Anonymous sign-in failed, continuing as unauthenticated:', err);
          // Fall through — set loading false so the login screen shows
        }
      }
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    localStorage.setItem('active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (selectedLanguage) {
      localStorage.setItem('selected_language', selectedLanguage);
    } else {
      localStorage.removeItem('selected_language');
    }
  }, [selectedLanguage]);

  const handleDeveloperLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setDevLoginError('');
    if (!devUsername || !devPin) return;

    try {
      const q = query(collection(db, 'lexiconDevelopers'), where('username', '==', devUsername.trim().toLowerCase()), where('pin', '==', devPin));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setDevLoginError('Invalid Username or PIN.');
        return;
      }
      
      const devData = snap.docs[0].data();
      setDeveloperUser(devData);
      localStorage.setItem('lexicon_dev_user', JSON.stringify(devData));
      
      // Sign in anonymously to get a UID for storage uploads
      await signInAnonymously(auth);
      
      // Route directly to explorer
      setSelectedLanguage('Edo');
      setActiveTab('explorer');
    } catch (err) {
      console.error(err);
      setDevLoginError('Login failed. Please try again.');
    }
  };

  const handleSignOut = () => {
    setDeveloperUser(null);
    localStorage.removeItem('lexicon_dev_user');
    auth.signOut();
    setActiveTab('assistant');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <Languages className="w-12 h-12 text-[#5A5A40]" />
        </motion.div>
      </div>
    );
  }

  if (!user && !developerUser) {
    return (
      <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 bg-[#5A5A40] rounded-3xl flex items-center justify-center text-white shadow-2xl">
              <Globe className="w-10 h-10" />
            </div>
          </div>
          <h1 className="text-4xl font-serif text-white mb-3 tracking-tight leading-tight">
            Ọmwan <span className="italic text-[#8A8A60]">AI</span>
          </h1>
          <p className="text-sm text-[#5A5A40] mb-2 font-bold uppercase tracking-widest">Edo Language Assistant</p>
          <p className="text-[#6A6A6A] mb-10 leading-relaxed text-sm">
            Your intelligent guide to the Edo (Bini) language and culture. Ask questions, learn phrases, translate, and explore heritage — all in one place.
          </p>

          {!showDeveloperLogin ? (
            <div className="space-y-4">
              <button
                onClick={() => signIn()}
                className="w-full py-4 bg-[#5A5A40] text-white rounded-2xl font-medium hover:bg-[#6A6A50] transition-all shadow-lg flex items-center justify-center gap-3 text-sm"
              >
                <Globe size={18} />
                Continue with Google
              </button>
              <button
                onClick={() => setShowDeveloperLogin(true)}
                className="w-full py-4 bg-transparent border border-[#3A3A3A] text-white rounded-2xl font-medium hover:bg-[#1A1A1A] transition-all flex items-center justify-center gap-3 text-sm"
              >
                <Users size={18} />
                Developer Login
              </button>
              <p className="mt-4 text-[#3A3A3A] text-xs">Free to use · No credit card required</p>
            </div>
          ) : (
            <form onSubmit={handleDeveloperLogin} className="bg-[#1A1A1A] p-6 rounded-3xl border border-[#2A2A2A] text-left">
              <h3 className="text-xl font-serif mb-4">Lexicon Developer Portal</h3>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-[#5A5A5A] mb-1 uppercase tracking-widest">Username</label>
                  <div className="relative">
                    <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />
                    <input
                      type="text"
                      value={devUsername}
                      onChange={(e) => setDevUsername(e.target.value)}
                      className="w-full bg-[#0F0F0F] border border-[#3A3A3A] rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5A5A40]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#5A5A5A] mb-1 uppercase tracking-widest">PIN</label>
                  <div className="relative">
                    <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5A5A5A]" />
                    <input
                      type="password"
                      value={devPin}
                      onChange={(e) => setDevPin(e.target.value)}
                      className="w-full bg-[#0F0F0F] border border-[#3A3A3A] rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-[#5A5A40]"
                    />
                  </div>
                </div>
                {devLoginError && <p className="text-red-500 text-xs font-bold">{devLoginError}</p>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowDeveloperLogin(false)} className="flex-1 py-3 bg-[#0F0F0F] text-white rounded-xl text-sm font-bold hover:bg-black transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-3 bg-[#5A5A40] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#6A6A50] transition-colors">
                  Login <ArrowRight size={16} />
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white font-sans flex">
      {/* Sidebar */}
      <nav className="fixed left-0 top-0 h-screen w-16 flex flex-col items-center py-6 bg-[#1A1A1A] border-r border-[#2A2A2A] z-50">
        {/* Logo */}
        <div className="mb-8">
          <div className="w-9 h-9 bg-[#5A5A40] rounded-xl flex items-center justify-center">
            <Globe className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-2 w-full px-2">
          {/* Assistant — always visible */}
          <NavItem
            icon={<MessageSquare size={20} />}
            active={activeTab === 'assistant'}
            onClick={() => setActiveTab('assistant')}
            label="Ọmwan AI"
          />

          {/* Admin-only sections */}
          {isMasterAdmin && (
            <>
              <div className="h-px bg-[#2A2A2A] my-2 mx-2" />
              <NavItem
                icon={<BookOpen size={20} />}
                active={activeTab === 'discover'}
                onClick={() => { setActiveTab('discover'); setSelectedLanguage(null); }}
                label="Discover"
              />
              <NavItem
                icon={<Database size={20} />}
                active={activeTab === 'repository'}
                onClick={() => { setActiveTab('repository'); setSelectedLanguage(null); }}
                label="Repository"
              />
              <NavItem
                icon={<GraduationCap size={20} />}
                active={activeTab === 'training'}
                onClick={() => setActiveTab('training')}
                label="Train AI"
              />
              <NavItem
                icon={<Users size={20} />}
                active={activeTab === 'team'}
                onClick={() => setActiveTab('team')}
                label="Team"
              />
            </>
          )}

          {/* Lexicon Explorer access (Master Admin + Developers) */}
          {(isMasterAdmin || isDeveloper) && selectedLanguage && (
             <NavItem
               icon={<Brain size={20} />}
               active={activeTab === 'explorer'}
               onClick={() => setActiveTab('explorer')}
               label="Explorer"
             />
          )}
        </div>

        {/* User avatar + sign out */}
        <div className="flex flex-col items-center gap-3">
          {developerUser ? (
            <div className="w-8 h-8 rounded-full bg-[#5A5A40] text-white flex items-center justify-center text-xs font-bold border border-[#3A3A3A]" title={developerUser.username}>
              {developerUser.username.substring(0, 2).toUpperCase()}
            </div>
          ) : user?.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-8 h-8 rounded-full border border-[#3A3A3A]"
              referrerPolicy="no-referrer"
            />
          ) : null}
          <button
            onClick={handleSignOut}
            className="p-2 text-[#5A5A5A] hover:text-white transition-colors rounded-xl hover:bg-[#2A2A2A]"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="pl-16 flex-1 min-h-screen flex flex-col">
        <AnimatePresence mode="wait">
          {activeTab === 'assistant' && (
            <motion.div
              key="assistant"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col h-screen"
            >
              <EdoAssistant user={user} isAdmin={isAdmin} />
            </motion.div>
          )}

          {isMasterAdmin && activeTab === 'discover' && (
            <motion.div
              key="discover"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1"
            >
              <SearchLanguage
                onLanguageFound={(langName) => {
                  setSelectedLanguage(langName);
                  setActiveTab('explorer');
                }}
              />
            </motion.div>
          )}

          {isMasterAdmin && activeTab === 'repository' && (
            <motion.div
              key="repository"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              <AdminRepository
                onSelectLanguage={(langName) => {
                  setSelectedLanguage(langName);
                  setActiveTab('explorer');
                }}
              />
            </motion.div>
          )}

          {isAdmin && activeTab === 'explorer' && selectedLanguage && (
            <motion.div
              key="explorer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              <LanguageExplorer languageName={selectedLanguage} currentUser={user} isAdmin={isAdmin} />
            </motion.div>
          )}

          {isMasterAdmin && activeTab === 'training' && (
            <motion.div
              key="training"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto"
            >
              <AdminTraining />
            </motion.div>
          )}
          
          {isMasterAdmin && activeTab === 'team' && (
            <motion.div
              key="team"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 overflow-y-auto"
            >
              <TeamManagement />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({
  icon, active, onClick, label,
}: {
  icon: React.ReactElement;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`w-full p-3 rounded-xl transition-all flex items-center justify-center ${
          active
            ? 'bg-[#5A5A40] text-white'
            : 'text-[#5A5A5A] hover:text-white hover:bg-[#2A2A2A]'
        }`}
      >
        {icon}
      </button>
      <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 py-1 px-2 bg-[#2A2A2A] border border-[#3A3A3A] text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest whitespace-nowrap z-[100] pointer-events-none">
        {label}
      </span>
    </div>
  );
}
