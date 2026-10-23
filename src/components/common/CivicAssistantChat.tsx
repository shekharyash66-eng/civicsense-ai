import React, { useState, useRef, useEffect } from 'react';
import { useCivic } from '../../context/CivicContext';
import { MessageSquare, X, Send, Sparkles, Trash2, Bot, User, Loader2, AlertCircle, ChevronDown, Check } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isRefusal?: boolean;
}

const SUGGESTED_QUESTIONS = [
  'Mujhe complaint register karni hai.',
  'Pothole ki complaint kaise karun?',
  'Meri complaint ka status kaise check karun?',
  'Kachra jama hone par kya karna chahiye?',
  'Water leakage ki report kaise karun?',
  'Meri complaint ki priority kaise decide hoti hai?',
];

const INITIAL_WELCOME_MESSAGE = 'Namaste! 👋 Main aapka CivicSense AI Assistant hoon. Aap apni civic problem batayein — jaise kachra, pothole, paani leakage, drainage, streetlight ya complaint tracking. Main aapko sahi aur practical guidance dene mein madad karunga.';

export const CivicAssistantChat: React.FC = () => {
  const { authToken } = useCivic();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('civic_assistant_chat_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        // Fall through
      }
    }
    return [
      {
        id: 'msg-welcome',
        sender: 'assistant',
        text: INITIAL_WELCOME_MESSAGE,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  useEffect(() => {
    try {
      localStorage.setItem('civic_assistant_chat_history', JSON.stringify(messages));
    } catch (e) {
      // Storage limits ignored
    }
  }, [messages]);

const getClientFallbackMessage = (queryText: string): string => {
  const q = queryText.toLowerCase().trim();

  // 1. Pain / Leg / Injury / Accident / Health concerns
  if (
    q.includes('pain') ||
    q.includes('leg') ||
    q.includes('hurt') ||
    q.includes('dard') ||
    q.includes('chot') ||
    q.includes('injury') ||
    q.includes('accident') ||
    q.includes('hospital') ||
    q.includes('doctor') ||
    q.includes('fracture') ||
    q.includes('wound') ||
    q.includes('gir gaya') ||
    q.includes('fall') ||
    q.includes('knee') ||
    q.includes('foot')
  ) {
    return "I'm sorry to hear that! Agar aapko dard ya chot aayi hai, kripya pehle kisi Doctor ya Emergency Medical Service (**108 / 102**) se sampark karein aur first-aid lein. Aapki health aur safety sabse pehle hai! 🙏\n\n🏥 **Civic Hazard & Defect Reporting:**\nAgar yeh chot kisi sadak ke pothole, khule manhole, toote hue footpath ya andhere ki wajah se hui hai, toh aap yahan **'Report Issue'** tab mein jakar us dangerous spot ki photo aur exact location ke sath complaint submit kar sakte hain.\n\n⚠️ Complaint form mein **'Flag as Public Safety Emergency'** tick karein taaki Municipal Rapid Response team isko highest priority par repair kare aur baaki nagrik surakshit rahein.";
  }

  // 2. Greetings
  if (
    q === 'hi' ||
    q === 'hello' ||
    q === 'hey' ||
    q === 'namaste' ||
    q === 'pranam' ||
    q.startsWith('hi ') ||
    q.startsWith('hello ') ||
    q.startsWith('hey ') ||
    q.includes('kaise ho') ||
    q.includes('good morning') ||
    q.includes('good evening') ||
    q.includes('how are you')
  ) {
    return "Namaste! 🙏 Main aapka CivicSense AI Assistant hoon.\n\nMain shehar ke civic issues—jaise **sadak ke gaddhe (potholes), kachra (garbage), paani leakage/drainage, tooti streetlights**—ko report karne, unka priority score calculate karne aur live status track karne mein aapki poori madad karta hoon.\n\nBatayein, aaj main aapki kya madad kar sakta hoon? Aap apna sawaal pooch sakte hain ya upar diye gaye options me se select kar sakte hain!";
  }

  // 3. Emergency & Hazards
  if (
    q.includes('emergency') ||
    q.includes('danger') ||
    q.includes('khatra') ||
    q.includes('sparking') ||
    q.includes('live wire') ||
    q.includes('taar gir gaya') ||
    q.includes('fire') ||
    q.includes('short circuit') ||
    q.includes('manhole khula')
  ) {
    return "🚨 **Urgent Civic Safety Alert:**\n\n1. **Safe Distance Banayein**: Live wires, sparking transformers, deep open manholes ya flooded drainage se turant door rahein!\n2. **Emergency Hotlines Par Call Karein**:\n   • **112**: All-in-One National Emergency Helpline\n   • **101**: Fire Brigade\n   • **108**: Ambulance / Medical Emergency\n3. **CivicSense Platform Par Rapid Alert File Karein**:\n   Top bar mein **'Report Issue'** button dabayein, category chunein aur form mein **'Flag as Public Safety Emergency'** tick karein.";
  }

  // 4. SLA & Resolution Timelines
  if (
    q.includes('kab tak') ||
    q.includes('kitna time') ||
    q.includes('kitne din') ||
    q.includes('how long') ||
    q.includes('sla') ||
    q.includes('timeline') ||
    q.includes('kab solve')
  ) {
    return "⏱️ **CivicSense AI Municipal SLA & Resolution Timelines:**\n\n• 🔴 **Critical Priority (Score 80-100)**: **24 Ghante** ke andar action (open manholes, live electrical wires).\n• 🟠 **High Priority (Score 60-79)**: **48 Ghante** ke andar (major potholes, drinking water pipe burst).\n• 🟡 **Medium Priority (Score 35-59)**: **3 se 5 din** (garbage overflow, non-functional streetlights).\n• 🟢 **Low Priority (Score 0-34)**: **7 din** (minor road/footpath maintenance).\n\nApni specific complaint ka live status janane ke liye **'Track Complaint'** tab par apna Ticket ID search karein!";
  }

  // 5. Account & Auth
  if (
    q.includes('login') ||
    q.includes('signin') ||
    q.includes('sign in') ||
    q.includes('signup') ||
    q.includes('register account') ||
    q.includes('password') ||
    q.includes('otp')
  ) {
    return "🔐 **Citizen Account & Authentication Assistance:**\n\n• **Google Sign-In**: 'Continue with Google' par click karke direct access paayein.\n• **Phone OTP / Email OTP**: Apna mobile number ya email enter karein aur received verification code dalein.\n• **Password Reset**: Agar password bhool gaye hain, toh 'Forgot Password' link par click karein.\n\nSign in karne ke baad aap **'My Submitted Complaints'** mein apni sabhi past reports live dekh sakte hain!";
  }

  const isCategory =
    q.includes('kya kya') ||
    q.includes('kya complain') ||
    q.includes('konsi complain') ||
    q.includes('kaun si') ||
    q.includes('kya file') ||
    q.includes('kya report') ||
    q.includes('categories') ||
    q.includes('types');

  if (isCategory) {
    return "📋 **CivicSense AI par aap in sabhi Civic Issues ki Complaint file kar sakte hain:**\n\n1. 🛣️ **Potholes & Road Damage**: Sadak ke gaddhe, tooti sadak, manhole damage, broken pavements.\n2. 🧹 **Garbage & Sanitation**: Kachra na uthna, overflowing dustbins, open waste dump, safai ki kami.\n3. 💧 **Water Leakage & Drainage**: Paani ke pipe leakage, sewage overflow, clogged naliyan, waterlogging.\n4. 💡 **Broken Streetlights & Electrical**: Tooti streetlights, live bijli wires, sparking transformers.\n5. 🚧 **Public Infrastructure**: Broken footpaths, damaged public benches, park maintenance.\n6. 🚸 **Pedestrian & Traffic Safety**: Missing traffic signs, unsafe zebra crossings, damaged speed bumps.\n\nNayi complaint file karne ke liye top bar mein **'Report Issue'** button par click karein!";
  }

  const isStatus =
    q.includes('status') ||
    q.includes('track') ||
    q.includes('kya hua') ||
    q.includes('kaha tak') ||
    q.includes('mera status') ||
    q.includes('meri complaint') ||
    (q.includes('complain') && (q.includes('hua') || q.includes('dekhna') || q.includes('kiya')));

  if (isStatus) {
    return "🔍 **Complaint Status Check:**\n\nAapki complaint ka live status check karne ke liye:\n1. Navigation bar mein **'Track Complaint'** tab par click karein.\n2. Apna Ticket ID (e.g. **CIV-1001**) enter karke Search karein.\n3. Agar aap signed-in hain, toh profile dropdown mein **'My Submitted Complaints'** par click karke apni tickets ki direct history dekhein!";
  }

  if (q.includes('pothole') || q.includes('gaddha') || q.includes('sadak') || q.includes('road')) {
    return "🛣️ **Pothole ya Sadak Kharaab hone par complaint kaise karein:**\n\n1. Top menu mein **'Report Issue'** tab par click karein.\n2. Title & Description mein jagah aur problem likhein.\n3. Category mein **'Potholes & Road Damage'** choose karein.\n4. Clear photo upload karein aur exact landmark add karein.\n5. AI System safety risk aur severity ka score calculate karke Public Works Department ko assign karega.";
  }
  if (q.includes('kachra') || q.includes('garbage') || q.includes('waste') || q.includes('safai')) {
    return "🧹 **Kachra ya Safai (Garbage & Sanitation) ki complaint:**\n\n1. **'Report Issue'** form open karein.\n2. Category **'Garbage & Sanitation'** select karein.\n3. Location & photo add karke Submit karein.\n4. Ticket direct **Waste & Environmental Sanitation Department** ko bhej diya jayega.";
  }
  if (q.includes('water') || q.includes('paani') || q.includes('leak') || q.includes('drainage')) {
    return "💧 **Paani Leakage ya Sewage Overflow ki complaint:**\n\n1. Category **'Water Leakage & Drainage'** select karein.\n2. Problem details & location enter karke submit karein.\n3. **Municipal Water Board** inspection verify karke action lega.";
  }
  if (q.includes('light') || q.includes('bijli') || q.includes('wire') || q.includes('andhera')) {
    return "💡 **Broken Streetlight ya Bijli problem report karne ke liye:**\n\n1. **'Report Issue'** tab select karein.\n2. Category **'Broken Streetlights & Electrical'** select karein.\n3. Pole number ya nearest landmark specify karein.\n4. Ticket **City Power & Electrical Authority** ko assign hoga.";
  }

  return `CivicSense AI Assistant aapki seva mein hazir hai! ✨\n\nAap CivicSense platform par shehar ki kisi bhi civic samasya ko aasaani se manage kar sakte hain:\n\n• 📝 **Nayi Complaint**: Sadak ke gaddhe, tooti streetlight, paani leakage ya kachra report karne ke liye upar **'Report Issue'** par click karein.\n• 🔍 **Status Check**: Apni logged complaint ka progress janane ke liye **'Track Complaint'** par Ticket ID enter karein.\n• ⚡ **Urgent Hazard**: Agar koi spot dangerous hai ya kisi ko chot pahunchi hai, toh report karte waqt **'Flag as Public Safety Emergency'** tick karein.\n\nAgar aapke paas koi specific Ticket ID ya location hai, toh yahan share karein!`;
};

  const handleSendMessage = async (textToSend?: string) => {
    const queryText = (textToSend || input).trim();
    if (!queryText || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setError(null);
    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          message: queryText,
          conversationHistory: messages.slice(-8),
        }),
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error('Failed to fetch response from AI Assistant');
      }

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: data.reply || getClientFallbackMessage(queryText),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isRefusal: !!data.isRefusal,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      clearTimeout(timeoutId);
      console.warn('AI Assistant Request Error or Timeout, using client fallback:', err);
      const fallbackText = getClientFallbackMessage(queryText);
      const fallbackMsg: ChatMessage = {
        id: `ast-fallback-${Date.now()}`,
        sender: 'assistant',
        text: fallbackText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    const welcomeMsg: ChatMessage = {
      id: `msg-welcome-${Date.now()}`,
      sender: 'assistant',
      text: INITIAL_WELCOME_MESSAGE,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages([welcomeMsg]);
    localStorage.removeItem('civic_assistant_chat_history');
    setShowClearConfirm(false);
    setError(null);
  };

  return (
    <>
      {/* Floating Chat Button (Bottom-Right) */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-slate-900 hover:bg-slate-800 text-white p-3.5 sm:px-4 sm:py-3.5 rounded-2xl shadow-2xl border border-slate-700 transition-all transform hover:scale-105 flex items-center gap-2.5 group"
          aria-label="Open CivicSense AI Assistant Chat"
        >
          <div className="relative">
            <Bot className="w-6 h-6 text-teal-400 group-hover:rotate-12 transition-transform" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-bold leading-tight">Civic AI Assistant</div>
            <div className="text-[10px] text-teal-300">Ask Civic Guidance</div>
          </div>
        </button>
      )}

      {/* Floating Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[400px] h-[580px] max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-300 dark:border-slate-800 flex flex-col overflow-hidden font-sans text-slate-800 dark:text-slate-100 animate-in fade-in duration-200">
          {/* Header */}
          <div className="bg-slate-900 text-white p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-950 border border-teal-700/80 text-teal-400 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-xs text-white tracking-tight">CivicSense AI Assistant</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-[10px] text-slate-400">Your Civic Problems, Our Smart Guidance.</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowClearConfirm(!showClearConfirm)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Clear Chat History"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close Chat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Clear Confirmation Banner */}
          {showClearConfirm && (
            <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800/80 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between shrink-0">
              <span>Clear entire conversation history?</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearChat}
                  className="px-2.5 py-1 bg-amber-600 text-white rounded font-bold text-[11px] hover:bg-amber-700"
                >
                  Yes, Clear
                </button>
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="px-2 py-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium text-[11px]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Chat Messages Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 dark:bg-slate-950/50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-slate-900 text-teal-400 flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div className={`max-w-[82%] space-y-1 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                  <div
                    className={`p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.sender === 'user'
                        ? 'bg-slate-900 dark:bg-teal-700 text-white rounded-tr-2xs shadow-2xs'
                        : msg.isRefusal
                        ? 'bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-950 dark:text-amber-200 rounded-tl-2xs shadow-2xs'
                        : 'bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-2xs shadow-2xs'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <div className="text-[9px] text-slate-400 px-1 font-mono">{msg.timestamp}</div>
                </div>

                {msg.sender === 'user' && (
                  <div className="w-7 h-7 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 w-max shadow-2xs">
                <Loader2 className="w-4 h-4 animate-spin text-teal-600 dark:text-teal-400" />
                <span>CivicSense AI Assistant typing...</span>
              </div>
            )}

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Questions Strip */}
          <div className="p-2.5 bg-slate-100/80 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 overflow-x-auto whitespace-nowrap flex gap-1.5 shrink-0 scrollbar-none">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                onClick={() => handleSendMessage(q)}
                disabled={loading}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 hover:bg-teal-50 dark:hover:bg-teal-950 text-slate-700 dark:text-slate-300 hover:text-teal-900 dark:hover:text-teal-300 border border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700 rounded-full text-[11px] font-medium transition-colors shrink-0 shadow-2xs disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pothole, kachra, paani leakage ke baare mein poochein..."
              disabled={loading}
              className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white dark:focus:bg-slate-800"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-teal-400 dark:text-white rounded-xl font-bold transition-all disabled:opacity-40 shrink-0 shadow-2xs"
              aria-label="Send Message"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      )}
    </>
  );
};
