/**
 * AI provider module — uses Groq (Llama 3.3 70B) for text/chat
 * and Tavily for web search grounding in language discovery.
 *
 * Drop-in replacement for the previous Gemini-based gemini.ts.
 */

// ---------------------------------------------------------------------------
// Groq client (OpenAI-compatible)
// ---------------------------------------------------------------------------

const GROQ_API_URL = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function groqChat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  temperature = 0.7
): Promise<string> {
  const res = await fetch(`${GROQ_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ---------------------------------------------------------------------------
// Streaming version — yields text chunks as they arrive (SSE)
// ---------------------------------------------------------------------------

export async function* groqChatStream(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  temperature = 0.7
): AsyncGenerator<string> {
  const res = await fetch(`${GROQ_API_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      temperature,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq stream error ${res.status}: ${err}`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === 'data: [DONE]') continue;
      if (!trimmed.startsWith('data: ')) continue;
      try {
        const json = JSON.parse(trimmed.slice(6));
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // malformed chunk — skip
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tavily web search
// ---------------------------------------------------------------------------

async function tavilySearch(query: string): Promise<{ title: string; url: string; content: string }[]> {
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'advanced',
      max_results: 6,
      include_answer: false,
    }),
  });

  if (!res.ok) {
    console.warn('Tavily search failed, continuing without web results');
    return [];
  }

  const data = await res.json();
  return (data.results ?? []).map((r: any) => ({
    title: r.title ?? '',
    url: r.url ?? '',
    content: r.content ?? '',
  }));
}

// ---------------------------------------------------------------------------
// Language discovery
// ---------------------------------------------------------------------------

export async function discoverLanguage(
  nameOrRegion: string,
  location: string,
  isRegional = false
) {
  // 1. Pull web context via Tavily
  const searchQuery = isRegional
    ? `indigenous languages of ${nameOrRegion} region ${location} history culture vocabulary`
    : `${nameOrRegion} language ${location} dictionary grammar history culture`;

  const webResults = await tavilySearch(searchQuery);

  const webContext =
    webResults.length > 0
      ? `\n\nWeb research context:\n${webResults
          .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`)
          .join('\n\n')}`
      : '';

  // 2. Build prompt
  const prompt = isRegional
    ? `Identify and research the major indigenous languages spoken in the ${nameOrRegion} region (located in ${location}).
For EACH language found:
1. Provide its name.
2. A brief history and cultural context.
3. A few common words/phrases with translations.

Format the response as a clear list of languages with their respective details. I need this to train an AI model on the linguistic diversity of this region.${webContext}`
    : `Research the ${nameOrRegion} language, which originates from ${location}.
I need detailed materials to train an AI and help users learn:
1. A dictionary of common words and phrases (at least 20), with translations and pronunciation guides.
2. Grammar rules (sentence structure, verbs, nouns).
3. The alphabet and how it is pronounced.
4. History of the people and the culture.
5. Sample sentences.
6. Exactly 3 male names and 3 female names that are common/traditional for this language group (for AI voice personas).

Format the output as a detailed report, citing sources where possible. Focus on being a 'material source' for an AI model.${webContext}`;

  const text = await groqChat([{ role: 'user', content: prompt }], 0.5);

  // Return sources in the same shape the rest of the app expects
  const sources = webResults.map((r) => ({ web: { uri: r.url, title: r.title } }));

  return { text, sources };
}

// ---------------------------------------------------------------------------
// Translation helper (kept for potential future use)
// ---------------------------------------------------------------------------

export async function translateAndSpeak(text: string, language: string): Promise<string> {
  return groqChat([
    {
      role: 'user',
      content: `Translate the following to ${language}: "${text}". Provide the translation and a phonetic pronunciation guide.`,
    },
  ]);
}

// ---------------------------------------------------------------------------
// Edo system instruction (unchanged — this IS the knowledge source)
// ---------------------------------------------------------------------------

export const EDO_SYSTEM_INSTRUCTION = `You are Ọmwan — a world-class AI assistant who is also an expert in the Edo (Bini) language and culture. You have three core capabilities:

1. **Edo Language Expert** — teach, translate, and converse in Edo (Bini)
2. **Elite Software Engineer** — build complete, beautiful, production-quality apps and websites
3. **Universal Knowledge Guide** — answer any question on any topic using your broad knowledge and web search results

---

## LANGUAGE AND TRANSLATION RULES (CRITICAL)
- Whenever you write an answer or a sentence in the local language (Edo), you MUST automatically translate it to English alongside the Edo text so the user can understand.
- You MUST always add phonetic pronunciation guides in brackets [like this] for any local language words you use.

---

## CAPABILITY 1: EDO LANGUAGE

### Understanding Edo Coding Requests
Users may describe what they want to build IN EDO LANGUAGE. Always interpret and build it.

Key Edo coding words:
- Gha = Make/Build/Create | I hia = I want/need | Ebe = Page | Vbe = In/For
- Rrie = Go | Ho = Show/Display | Gbe = Add/Bring | Dẹ = Get/Fetch
- Ọmọ = Item/Element | Ẹwu = Style/Design | Owa = Home | Ẹki = School
- Ọkhuae = White | Ẹbibi = Black | Ẹguan = Red | Igho = Money | Evbare = Food

### Edo Language Rules
- Pronunciation: ọ = 'or', ẹ = 'eh', gh = 'gi+h', mw = 'wh', kp = silent k
- Focus Marker: "Ize ọre ọ rrie owa" = It is Ize who went home
- Questions: Vbọ (What), Ghẹẹ (Who), Vbakha (How), Vbevbọ (Where)
- Greetings: Kọyo (Hello), Obowie (Good morning), Ọyese (I am fine), Uru ese (Thank you)
- Numbers: Okpa(1) Eva(2) Eha(3) Ene(4) Isẹ(5) Ehan(6) Ihinron(7) Erele(8) Ihinrin(9) Iwẹ(10)
- Culture: Igue Festival, Queen Idia (Iyoba), Osanobua (God), Ọba (King)

---

## CAPABILITY 2: ELITE SOFTWARE ENGINEER (DEEPSEEK-LEVEL CAPABILITY)

You are an advanced, DeepSeek-level AI programmer. You write code like a principal engineer at a top tech company. Your code is:
- **Complete** — never truncated, always fully working out of the box
- **Beautiful** — modern design, proper spacing, professional UI, stunning aesthetics
- **Production-quality** — error handling, accessibility, responsive design

### Multi-page Websites & Complex Apps
When asked to build a website or app, you are capable of building ANY number of pages and designs. Use this structure:
- Modern CSS (gradients, shadows, animations, glassmorphism, responsive grid/flexbox)
- Build ALL pages requested. Do not leave placeholder links; implement the actual layout and logic for every requested page.
- Smooth transitions and hover effects
- Professional typography and color schemes
- Navigation between pages (tabs, routing, or multi-section)

### Code Standards
- HTML/CSS: Use CSS variables, flexbox/grid, smooth animations
- JavaScript: Modern ES6+, clean functions, proper event handling
- React: Functional components, hooks, clean state management
- Python: PEP8, type hints, docstrings
- Always use markdown code blocks with language specified
- For multi-file projects, clearly label each file and its path.

### When building websites/apps:
1. Make it visually impressive — use gradients, cards, animations to WOW the user.
2. Include all requested pages/sections with high-fidelity placeholder content.
3. Provide the full code so the user can copy/paste and have a 100% working, stunning result.

---

## CAPABILITY 3: UNIVERSAL KNOWLEDGE GUIDE & LECTURER

You can lecture and answer questions on ANY topic making use of the entire internet as your source of information:
- Science, history, mathematics, philosophy, medicine, law, economics
- Technology, programming, AI, cybersecurity
- Arts, literature, music, film
- Current events (using web search results provided)
- You can answer ANY curious questions about the world, the universe, people, or facts.

### How to answer knowledge questions and give lectures:
- Provide highly detailed, in-depth lectures and answers.
- Give thorough, well-structured answers using your vast knowledge base.
- Use headers and bullet points for complex topics.
- Cite sources when web search results are provided.
- Be accurate, engaging, and educational.

---

## RESPONSE STYLE
- **ONE DEFINITIVE ANSWER**: Provide exactly ONE clear, definitive answer to the user's prompt. Do NOT provide multiple alternative answers, do NOT repeat yourself, and STOP answering once the question is fully addressed.
- For code: complete, beautiful, working — never say "add your own styling".
- For knowledge: thorough, structured, deep, and engaging.
- For Edo: warm, encouraging, use greetings naturally. Automatically provide English translations and phonetics.`;



// ---------------------------------------------------------------------------
// Whisper transcription via Groq — handles Edo phonemes far better than
// the browser Web Speech API which only knows English phonemes.
// ---------------------------------------------------------------------------

export async function transcribeWithWhisper(audioBlob: Blob): Promise<string> {
  try {
    const formData = new FormData();
    // Groq Whisper expects the file with a name that has an audio extension
    formData.append('file', audioBlob, 'recording.webm');
    formData.append('model', 'whisper-large-v3');
    // Hint: telling Whisper the language is Yoruba (closest widely-supported
    // West African language) helps it stay closer to the actual phonemes
    // rather than forcing English. Leave blank to let it auto-detect.
    formData.append('language', '');
    formData.append('response_format', 'json');
    formData.append('temperature', '0');

    const res = await fetch(`${GROQ_API_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        // Do NOT set Content-Type — browser sets it with boundary automatically
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Whisper error:', err);
      return '';
    }

    const data = await res.json();
    return (data.text ?? '').trim();
  } catch (err) {
    console.error('Whisper transcription failed:', err);
    return '';
  }
}

// ---------------------------------------------------------------------------
// URL content fetcher — used by the assistant when user pastes a URL
// ---------------------------------------------------------------------------

export async function fetchUrlContent(url: string): Promise<string> {
  try {
    const res = await fetch('https://api.tavily.com/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        urls: [url],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const content = data.results?.[0]?.raw_content ?? data.results?.[0]?.content ?? '';
      return content.slice(0, 8000);
    }
  } catch (_) { /* fall through */ }
  return '';
}

// ---------------------------------------------------------------------------
// Attachment type for multimodal chat
// ---------------------------------------------------------------------------

export interface ChatAttachment {
  type: 'image' | 'audio' | 'url';
  name: string;
  data: string; // base64 for image/audio, raw URL string for url type
  mimeType?: string;
}

// Detect if the message is asking to search the web or is a curious question
function needsWebSearch(message: string): boolean {
  const triggers = [
    // explicit search
    'search', 'look up', 'find out', 'google',
    // current info
    'latest', 'news', 'current', 'today', 'recent', 'now', '2024', '2025',
    // curious questions about the world
    'what is', "what's", 'who is', "who's", 'where is', 'when did', 'how does',
    'how do', 'why does', 'why is', 'explain', 'tell me about', 'what are',
    'how many', 'how much', 'difference between', 'compare', 'history of',
    'meaning of', 'definition of', 'facts about', 'information about',
    // topics that need live data
    'price', 'cost', 'weather', 'stock', 'score', 'result',
  ];
  const lower = message.toLowerCase();
  return triggers.some(t => lower.includes(t));
}

// Detect URLs in a message
function extractUrls(message: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/g;
  return message.match(urlRegex) ?? [];
}

// ---------------------------------------------------------------------------
// Edo chat session — stateful multi-turn conversation via Groq
// Supports: plain text, web search, URL reading, image/audio attachments
// ---------------------------------------------------------------------------

export interface EdoChat {
  sendMessage: (opts: {
    message: string;
    attachments?: ChatAttachment[];
    vocabContext?: string;
  }) => Promise<{ text: string }>;
  sendMessageStream: (opts: {
    message: string;
    attachments?: ChatAttachment[];
    vocabContext?: string;
  }) => AsyncGenerator<string>;
}

export function getEdoChat(): EdoChat {
  const history: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
    { role: 'system', content: EDO_SYSTEM_INSTRUCTION },
  ];

  async function buildUserContent(
    message: string,
    attachments: ChatAttachment[],
    vocabContext?: string
  ): Promise<string> {
    let userContent = message;

    if (vocabContext) {
      userContent = `[Admin vocabulary database — use this to answer questions about specific Edo words]:\n${vocabContext}\n\nUser: ${message}`;
    }

    const urls = extractUrls(message);
    if (urls.length > 0) {
      const fetched = await Promise.all(urls.map(fetchUrlContent));
      const urlContext = fetched
        .map((c, i) => c ? `[Content from ${urls[i]}]:\n${c}` : '')
        .filter(Boolean)
        .join('\n\n');
      if (urlContext) userContent += `\n\n${urlContext}`;
    }

    if (needsWebSearch(message) && urls.length === 0) {
      const results = await tavilySearch(message);
      if (results.length > 0) {
        const searchContext = results
          .map((r, i) => `[${i + 1}] ${r.title}\n${r.content}`)
          .join('\n\n');
        userContent += `\n\n[Web search results]:\n${searchContext}`;
      }
    }

    if (attachments.length > 0) {
      const attachDesc = attachments.map(a => {
        if (a.type === 'image') return `[User attached image: ${a.name}. Describe what you see and relate it to Edo language/culture if relevant.]`;
        if (a.type === 'audio') return `[User attached audio: ${a.name}. Ask the user to describe what was said so you can help translate or interpret it.]`;
        return '';
      }).filter(Boolean).join('\n');
      if (attachDesc) userContent += `\n\n${attachDesc}`;
    }

    return userContent;
  }

  return {
    async sendMessage({ message, attachments = [], vocabContext }) {
      const userContent = await buildUserContent(message, attachments, vocabContext);
      history.push({ role: 'user', content: userContent });
      const reply = await groqChat(history, 0.7);
      history.push({ role: 'assistant', content: reply });
      return { text: reply };
    },

    async *sendMessageStream({ message, attachments = [], vocabContext }) {
      const userContent = await buildUserContent(message, attachments, vocabContext);
      history.push({ role: 'user', content: userContent });

      let fullReply = '';
      for await (const chunk of groqChatStream(history, 0.7)) {
        fullReply += chunk;
        yield chunk;
      }
      history.push({ role: 'assistant', content: fullReply });
    },
  };
}

// ---------------------------------------------------------------------------
// Audio — TTS is handled by the browser Speech API (see voice.ts).
// generateEdoAudio is kept as a no-op stub so any remaining import doesn't
// break the build; playEdoSpeech in voice.ts falls back to browser TTS.
// ---------------------------------------------------------------------------

export async function generateEdoAudio(_text: string): Promise<string | null> {
  return null;
}

// ---------------------------------------------------------------------------
// Audio transcription — removed AI dependency.
// Admin types the Edo word manually; this stub keeps the build clean.
// ---------------------------------------------------------------------------

export async function transcribeEdoAudio(
  _audioBase64: string,
  _mimeType: string
): Promise<{ word: string; phonetic: string }> {
  return { word: '', phonetic: '' };
}
