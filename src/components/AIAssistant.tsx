import React, { useState, useRef, useEffect } from 'react';
import { FiX, FiSend, FiPaperclip, FiUser, FiCpu } from 'react-icons/fi';
import type { ChatMessage, AttachmentContent } from '../types/ai';

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_KEY || '';
const OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || 'google/gemma-4-26b-a4b-it:free';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'];
const MAX_FILE_SIZE = 25 * 1024 * 1024;

let messageIdCounter = 0;
function nextId() { return `msg_${++messageIdCounter}_${Date.now()}`; }

interface AIAssistantProps {
  variant?: 'floating' | 'page';
}

const SYSTEM_PROMPT = `You are School OS Assistant, a helpful AI for a school management app. Guide users, explain features, and review documents. Be concise and practical. Support English, Hindi, and Marathi. Never reveal secrets or claim actions you didn't perform.`;

const AIAssistant: React.FC<AIAssistantProps> = ({ variant = 'floating' }) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentContent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: AttachmentContent[] = [];

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`Unsupported file type: ${file.type}`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`File too large: ${file.name} (max 25 MB)`);
        continue;
      }

      const data = await fileToBase64(file);
      newAttachments.push({
        type: file.type.startsWith('image/') ? 'image_url' : 'file',
        mime: file.type,
        data,
        originalName: file.name,
      });
    }

    setAttachments(prev => [...prev, ...newAttachments].slice(0, 3));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const buildMessages = () => {
    const result: any[] = [{ role: 'system', content: SYSTEM_PROMPT }];

    for (const msg of messages) {
      if (msg.role === 'error') continue;
      result.push({ role: msg.role, content: msg.content });
    }

    const parts: any[] = [{ type: 'text', text: input.trim() || '...' }];
    for (const att of attachments) {
      if (att.mime.startsWith('image/')) {
        parts.push({ type: 'image_url', image_url: { url: `data:${att.mime};base64,${att.data}` } });
      }
    }
    result.push({ role: 'user', content: parts });

    return result;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text && attachments.length === 0) return;

    const userMessage: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: text,
      attachments: attachments.map(a => ({ name: a.originalName, type: a.mime })),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    const currentAttachments = [...attachments];
    setAttachments([]);
    setLoading(true);
    setError(null);

    try {
      const openRouterMessages = buildMessages();

      const res = await fetch(OPENROUTER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'School OS',
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: openRouterMessages,
          max_tokens: 4096,
          temperature: 0.7,
        }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        throw new Error(`OpenRouter error (${res.status}): ${errText.substring(0, 200)}`);
      }

      const data: any = await res.json();
      const reply = data.choices?.[0]?.message?.content || '';

      if (!reply) throw new Error('AI returned an empty response');

      const assistantMessage: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('AI Assistant error:', err);
      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'error',
        content: err?.message || 'Failed to get response',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isPage = variant === 'page';

  const chatPanel = (
    <div className={`flex flex-col overflow-hidden ${isPage ? 'h-full bg-[#1A1A2E] border border-gray-700/50 rounded-2xl' : 'h-full'}`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-b border-gray-700/50 shrink-0">
        <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
          <FiCpu size={18} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-white">AI Assistant</h3>
          <p className="text-[10px] text-gray-400 truncate">Gemma via OpenRouter</p>
        </div>
        {!isPage && (
          <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white transition p-1 shrink-0">
            <FiX size={18} />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-2xl flex items-center justify-center mb-4">
              <FiCpu size={32} className="text-cyan-400/60" />
            </div>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
              Ask me anything about School OS — how to use features, review documents, or fix errors.
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-3 items-start ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
              msg.role === 'user'
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600'
                : msg.role === 'error'
                ? 'bg-red-500/20'
                : 'bg-cyan-500/20'
            }`}>
              {msg.role === 'user' ? <FiUser size={15} className="text-white" /> : msg.role === 'error' ? <FiX size={15} className="text-red-400" /> : <FiCpu size={15} className="text-cyan-400" />}
            </div>
            <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} max-w-[75%]`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-br-md'
                  : msg.role === 'error'
                  ? 'bg-red-500/10 border border-red-500/30 text-red-300 rounded-bl-md'
                  : 'bg-gray-800/70 text-gray-200 rounded-bl-md'
              }`}>
                {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
              </div>
              {msg.attachments && msg.attachments.length > 0 && (
                <div className="flex gap-1.5 mt-1.5 px-1">
                  {msg.attachments.map((a, i) => (
                    <span key={i} className="text-[10px] text-gray-500 bg-gray-800/40 px-2 py-0.5 rounded-full truncate max-w-[100px]">
                      {a.type.startsWith('image/') ? '📷' : a.type === 'application/pdf' ? '📄' : '🎥'} {a.name}
                    </span>
                  ))}
                </div>
              )}
              <p className={`text-[10px] mt-1 px-1 text-gray-600`}>
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 items-start">
            <div className="w-8 h-8 bg-cyan-500/20 rounded-xl flex items-center justify-center shrink-0">
              <FiCpu size={15} className="text-cyan-400" />
            </div>
            <div className="bg-gray-800/70 rounded-2xl rounded-bl-md px-4 py-3.5">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex justify-center">
            <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="px-4 py-2.5 border-t border-gray-700/50 flex flex-wrap gap-2 shrink-0">
          {attachments.map((att, i) => (
            <span key={i} className="flex items-center gap-1.5 bg-gray-800/80 rounded-lg px-2.5 py-1 text-xs text-gray-300">
              {att.mime.startsWith('image/') ? '📷' : att.mime === 'application/pdf' ? '📄' : '🎥'}
              <span className="truncate max-w-[100px]">{att.originalName}</span>
              <button onClick={() => removeAttachment(i)} className="text-gray-500 hover:text-red-400 ml-0.5">
                <FiX size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-700/50 bg-black/20 shrink-0">
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 text-gray-400 hover:text-cyan-400 hover:bg-gray-800/60 rounded-xl transition shrink-0 mb-0.5"
            title="Attach file"
          >
            <FiPaperclip size={18} />
          </button>
          <input ref={fileInputRef} type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.mp4,.mpeg,.mov,.webm" onChange={handleFileSelect} className="hidden" />

          <div className="flex-1 flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1}
              className="flex-1 bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 transition min-h-[42px] max-h-[120px]"
            />
            <button
              onClick={sendMessage}
              disabled={loading || (!input.trim() && attachments.length === 0)}
              className="p-2.5 text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl hover:from-cyan-400 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition shrink-0 mb-0.5"
            >
              <FiSend size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (variant === 'page') {
    return chatPanel;
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-full shadow-2xl shadow-cyan-500/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        title="AI Assistant"
      >
        {open ? <FiX size={24} /> : <FiCpu size={24} />}
      </button>
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-96 h-[600px] max-h-[calc(100vh-180px)] bg-[#1A1A2E] border border-gray-700/50 rounded-2xl shadow-2xl backdrop-blur-xl">
          {chatPanel}
        </div>
      )}
    </>
  );
};

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const rendered = line
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-gray-700/60 px-1 rounded text-cyan-300 text-xs">$1</code>');

    if (line.startsWith('- ') || line.startsWith('* ')) {
      return <li key={i} className="text-sm text-gray-200 ml-4" dangerouslySetInnerHTML={{ __html: rendered.slice(2) }} />;
    }
    if (/^\d+\.\s/.test(line)) {
      return <li key={i} className="text-sm text-gray-200 ml-4 list-decimal" dangerouslySetInnerHTML={{ __html: rendered.replace(/^\d+\.\s/, '') }} />;
    }
    if (line.trim() === '') {
      return <div key={i} className="h-2" />;
    }
    return <p key={i} className="text-sm text-gray-200" dangerouslySetInnerHTML={{ __html: rendered }} />;
  });
}

export default AIAssistant;
