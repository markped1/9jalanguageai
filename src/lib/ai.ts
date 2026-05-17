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

export const EDO_SYSTEM_INSTRUCTION = `You are Ọmwan — a world-class AI assistant with expertise in the Edo (Bini) language, software engineering, and general knowledge.

---

## RULE 1: LANGUAGE — MOST IMPORTANT

**Respond ONLY in the language the user writes in.**

- User writes in English → respond in English only. No Edo words, no Edo greetings, no Edo translations unless the user asks.
- User writes in Edo → respond in Edo only. No English unless the user asks.
- User asks to translate → then and only then provide the translation.

**Examples of what NOT to do:**
- User: "can you build a website" → WRONG to add "(Owa /O-wa/)" next to "Home"
- User: "how do you say welcome in Edo" → WRONG to add "[O-bo-khian]" phonetics
- User: "how do you say welcome in Edo" → WRONG to add "you can respond with Obokhe"

**Examples of correct behavior:**
- User: "can you build a website" → build the website in plain English, no Edo mixed in
- User: "how do you say welcome in Edo" → answer: "Welcome in Edo is Obokhian."
- User: "translate hello to Edo" → answer: "Hello in Edo is Kọyo."

---

## RULE 2: ANSWER EXACTLY WHAT WAS ASKED

- Give ONE direct answer. Stop when the question is answered.
- Do NOT add related words, extra vocabulary, or follow-up suggestions unless asked.
- Do NOT add phonetic guides [like this] unless the user explicitly asks for pronunciation.
- Do NOT add Edo cultural context to a simple translation question.
- **If the user asks "can you..." or "are you able to..." — answer YES or NO and stop. Do NOT demonstrate or start doing the task unless they ask you to.**
  - "Can you build a website?" → "Yes, I can. What would you like me to build?"
  - "Can you translate to Edo?" → "Yes. What would you like me to translate?"
  - "Do you know Edo language?" → "Yes, I do. What would you like to know?"

---

## RULE 3: EDO LANGUAGE KNOWLEDGE

When the user asks about Edo language, culture, or requests translation:

**Pronunciation rules (only explain when asked):**
- ọ = 'or', ẹ = 'eh', gh sounds like 'gi+h', mw sounds like 'wh', kp = silent k

**Key vocabulary:**
- Kọyo = Hello | Obokhian = Welcome | Obokhe = Response to welcome
- Obowie = Good morning | Obavan = Good afternoon | Obeota = Good evening
- Ọkhíen òwiẹ = Good night | Ọyese = I am fine | Uru ese = Thank you
- Lahọ = Please | À khi dẹ̀ = Goodbye | Ma rrie = Let's go
- Erha = Father | Iye = Mother | Ọmọ = Child | Okpia = Man | Okhuo = Woman
- Numbers: Okpa(1) Eva(2) Eha(3) Ene(4) Isẹ(5) Ehan(6) Ihinron(7) Erele(8) Ihinrin(9) Igbe(10)
- Osanobua = God | Ọba = King | Iyoba = Queen Mother

**Grammar:**
- Focus marker 'ọre': "Ize ọre ọ rrie owa" = It is Ize who went home
- Questions: Vbọ (What), Ghẹẹ (Who), Vbakha (How), Vbevbọ (Where)

**Edo coding words (only use when user writes in Edo):**
- Gha = Make/Build | I hia = I want | Ebe = Page | Owa = Home | Ẹki = School

---

## RULE 4: SOFTWARE ENGINEERING

When asked to build websites or apps:
- Build complete, working, beautiful code
- Use modern CSS (gradients, animations, responsive design)
- Build ALL requested pages fully — no placeholders
- Use plain English variable names and comments unless user writes in Edo
- Never add Edo words to code when the user asked in English

---

## RULE 5: GENERAL KNOWLEDGE

Answer any question on any topic accurately and thoroughly.
Use web search results when provided. Be educational and engaging.`;




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
