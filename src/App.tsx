import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
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
import LanguagesMenu from './components/LanguagesMenu';
import GeneralAssistant from './components/GeneralAssistant';

const ADMIN_EMAIL = 'mckpedersen@gmail.com';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [developerUser, setDeveloperUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'home' | 'languages' | 'discover' | 'explorer' | 'repository' | 'training' | 'team'>(() => {
    return (localStorage.getItem('active_tab') as any) || 'home';
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

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u && !u.isAnonymous) {
        // Real Google user — clear any dev session
        setDeveloperUser(null);
        localStorage.removeItem('lexicon_dev_user');
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
      <div className="min-h-screen bg-white flex items-center justify-center relative overflow-hidden">
        <div className="fixed inset-0 opacity-[0.02]">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(#008751 1px, transparent 1px), linear-gradient(90deg, #008751 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />
        </div>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="relative z-10"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#008751] to-[#00A862] flex items-center justify-center shadow-2xl">
            <Languages className="w-8 h-8 text-white" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user && !developerUser) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
        {/* Subtle background */}
        <div className="fixed inset-0 opacity-[0.02]">
          <div className="absolute inset-0" style={{
            backgroundImage: 'linear-gradient(#008751 1px, transparent 1px), linear-gradient(90deg, #008751 1px, transparent 1px)',
            backgroundSize: '50px 50px'
          }} />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full relative z-10"
        >
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-[#008751] to-[#00A862] rounded-3xl flex items-center justify-center text-white shadow-2xl relative">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer rounded-3xl" />
              <Globe className="w-10 h-10 relative z-10" />
            </div>
          </div>
          <h1 className="text-5xl font-serif text-[#008751] mb-3 tracking-tight leading-tight">
            9jai <span className="italic text-transparent bg-clip-text bg-gradient-to-r from-[#008751] to-[#00A862]">AI</span>
          </h1>
          <p className="text-sm text-[#008751] mb-2 font-bold uppercase tracking-widest">Edo Language Assistant</p>
          <p className="text-[#008751]/60 mb-10 leading-relaxed text-sm max-w-sm mx-auto">
            Your intelligent guide to the Edo (Bini) language and culture. Ask questions, learn phrases, translate, and explore heritage.
          </p>

          {!showDeveloperLogin ? (
            <div className="space-y-4">
              <button
                onClick={() => signIn()}
                className="w-full py-4 bg-gradient-to-r from-[#008751] to-[#00A862] text-white rounded-2xl font-medium hover:shadow-lg hover:shadow-[#008751]/30 transition-all flex items-center justify-center gap-3 text-sm relative overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                <Globe size={18} className="relative z-10" />
                <span className="relative z-10">Continue with Google</span>
              </button>
              <button
                onClick={() => setShowDeveloperLogin(true)}
                className="w-full py-4 bg-white border-2 border-[#008751] text-[#008751] rounded-2xl font-medium hover:bg-[#008751]/5 transition-all flex items-center justify-center gap-3 text-sm"
              >
                <Users size={18} />
                Developer Login
              </button>
              <p className="mt-4 text-[#008751]/40 text-xs">Free to use · No credit card required</p>
            </div>
          ) : (
            <form onSubmit={handleDeveloperLogin} className="bg-white p-6 rounded-3xl border-2 border-[#008751]/20 text-left shadow-xl">
              <h3 className="text-xl font-serif mb-4 text-[#008751]">Lexicon Developer Portal</h3>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-[#008751]/60 mb-1 uppercase tracking-widest">Username</label>
                  <div className="relative">
                    <Users size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#008751]/60" />
                    <input
                      type="text"
                      value={devUsername}
                      onChange={(e) => setDevUsername(e.target.value)}
                      className="w-full bg-white border-2 border-[#008751]/20 rounded-xl py-3 pl-10 pr-4 text-[#008751] focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#008751]/60 mb-1 uppercase tracking-widest">PIN</label>
                  <div className="relative">
                    <Key size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#008751]/60" />
                    <input
                      type="password"
                      value={devPin}
                      onChange={(e) => setDevPin(e.target.value)}
                      className="w-full bg-white border-2 border-[#008751]/20 rounded-xl py-3 pl-10 pr-4 text-[#008751] focus:outline-none focus:border-[#008751] focus:ring-2 focus:ring-[#008751]/20 transition-all"
                    />
                  </div>
                </div>
                {devLoginError && <p className="text-red-500 text-xs font-bold">{devLoginError}</p>}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowDeveloperLogin(false)} className="flex-1 py-3 bg-white text-[#008751] rounded-xl text-sm font-bold hover:bg-[#008751]/5 transition-colors border-2 border-[#008751]/20">
                  Cancel
                </button>
                <button type="submit" className="flex-1 py-3 bg-gradient-to-r from-[#008751] to-[#00A862] text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-[#008751]/30 transition-all">
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
    <div className="min-h-screen bg-white text-[#008751] font-sans flex flex-col">
      {/* Subtle background pattern */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: 'linear-gradient(#008751 1px, transparent 1px), linear-gradient(90deg, #008751 1px, transparent 1px)',
          backgroundSize: '50px 50px'
        }} />
      </div>

      <div className="flex flex-1 relative z-10">
        {/* Sidebar */}
        <nav className="fixed left-0 top-0 h-screen w-16 flex flex-col items-center py-6 bg-gradient-to-b from-[#008751] to-[#00A862] shadow-xl z-50">
          {/* Logo */}
          <div className="mb-8">
            <div className="w-9 h-9 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
              <Globe className="w-5 h-5 text-white" />
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-2 w-full px-2">
            {/* Home - always visible */}
            <NavItem
              icon={<Globe size={20} />}
              active={activeTab === 'home'}
              onClick={() => setActiveTab('home')}
              label="Home"
            />

            {/* Languages menu - always visible */}
            <NavItem
              icon={<Languages size={20} />}
              active={activeTab === 'languages'}
              onClick={() => setActiveTab('languages')}
              label="Languages"
            />

            {/* Admin-only sections */}
            {isMasterAdmin && (
              <>
                <div className="h-px bg-white/20 my-2 mx-2" />
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
              <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-white flex items-center justify-center text-xs font-bold shadow-lg" title={developerUser.username}>
                {developerUser.username.substring(0, 2).toUpperCase()}
              </div>
            ) : user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="w-8 h-8 rounded-full border-2 border-white/30"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <button
              onClick={handleSignOut}
              className="p-2 text-white/70 hover:text-white transition-colors rounded-xl hover:bg-white/10"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </nav>

        {/* Main content */}
        <main className="pl-16 flex-1 min-h-screen flex flex-col bg-white">
          <AnimatePresence mode="wait">
            {activeTab === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1"
              >
                <GeneralAssistant user={user} isAdmin={isAdmin} />
              </motion.div>
            )}

            {activeTab === 'languages' && (
              <motion.div
                key="languages"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 overflow-y-auto"
              >
                <LanguagesMenu
                  onSelectLanguage={(langId, langName) => {
                    setSelectedLanguage(langName);
                    setActiveTab('explorer');
                  }}
                />
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

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#008751]/20 bg-white">
        <div className="px-6 py-4 flex items-center justify-center">
          <p className="text-[10px] text-[#008751]/60 font-medium tracking-wider">
            Designed by <span className="text-[#008751] font-bold">Thompson Obosa</span>
          </p>
        </div>
      </footer>
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
        className={`w-full p-3 rounded-xl transition-all flex items-center justify-center relative overflow-hidden ${
          active
            ? 'bg-white/20 backdrop-blur-sm text-white shadow-lg'
            : 'text-white/70 hover:text-white hover:bg-white/10'
        }`}
      >
        {active && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        )}
        <span className="relative z-10">{icon}</span>
      </button>
      <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 py-1 px-2 bg-[#008751] border border-white/20 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-widest whitespace-nowrap z-[100] pointer-events-none shadow-xl">
        {label}
      </span>
    </div>
  );
}
