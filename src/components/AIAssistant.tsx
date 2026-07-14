import React, { useState, useRef, useEffect } from 'react';
import { FiMessageCircle, FiX, FiSend, FiPaperclip, FiTrash2, FiUser, FiCpu } from 'react-icons/fi';
import { getAuth } from 'firebase/auth';
import type { ChatMessage, AIResponse, AttachmentContent } from '../types/ai';

const WORKER_URL = import.meta.env.VITE_AI_WORKER_URL || '';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB (worker enforces per-type limits)

let messageIdCounter = 0;
function nextId() { return `msg_${++messageIdCounter}_${Date.now()}`; }

const AIAssistant: React.FC = () => {
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

  const sendMessage = async () => {
    const text = input.trim();
    if (!text && attachments.length === 0) return;
    if (!WORKER_URL) {
      setError('AI Assistant URL not configured. Set VITE_AI_WORKER_URL in your .env file.');
      return;
    }

    const userMessage: ChatMessage = {
      id: nextId(),
      role: 'user',
      content: text,
      attachments: attachments.map(a => ({ name: a.originalName, type: a.mime })),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
    setLoading(true);
    setError(null);

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be signed in to use the AI Assistant.');
      }
      const token = await user.getIdToken();

      const history = messages
        .filter(m => m.role !== 'error')
        .slice(-20)
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          attachments: attachments.length > 0 ? attachments : undefined,
          conversationHistory: history.length > 0 ? history : undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error (${res.status})`);
      }

      const data: AIResponse = await res.json();

      const assistantMessage: ChatMessage = {
        id: nextId(),
        role: 'assistant',
        content: data.text || '(empty response)',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: ChatMessage = {
        id: nextId(),
        role: 'error',
        content: err.message || 'Failed to send message',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
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

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-full shadow-2xl shadow-cyan-500/30 flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        title="AI Assistant"
      >
        {open ? <FiX size={24} /> : <FiCpu size={24} />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-96 h-[600px] max-h-[calc(100vh-180px)] bg-[#1A1A2E] border border-gray-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border-b border-gray-700/50">
            <div className="w-9 h-9 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center">
              <FiCpu size={18} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">AI Assistant</h3>
              <p className="text-[10px] text-gray-400">Powered by OpenRouter</p>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white transition p-1">
              <FiX size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 scrollbar-thin">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <FiCpu size={40} className="text-gray-600 mb-3" />
                <p className="text-sm text-gray-500 max-w-xs">
                  Ask me anything about School OS — how to use features, review documents, or fix errors.
                </p>
              </div>
            )}

            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role !== 'user' && (
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'error' ? 'bg-red-500/20' : 'bg-cyan-500/20'}`}>
                    {msg.role === 'error' ? <FiX size={14} className="text-red-400" /> : <FiCpu size={14} className="text-cyan-400" />}
                  </div>
                )}
                <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-1' : 'order-2'}`}>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-tr-md'
                      : msg.role === 'error'
                      ? 'bg-red-500/10 border border-red-500/30 text-red-300 rounded-tl-md'
                      : 'bg-gray-800/60 text-gray-200 rounded-tl-md'
                  }`}>
                    {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                  </div>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex gap-1 mt-1 px-1">
                      {msg.attachments.map((a, i) => (
                        <span key={i} className="text-[10px] text-gray-500 bg-gray-800/40 px-2 py-0.5 rounded-full truncate max-w-[120px]">
                          {a.type.startsWith('image/') ? '📷 ' : a.type === 'application/pdf' ? '📄 ' : '🎥 '}
                          {a.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className={`text-[10px] mt-0.5 px-1 ${msg.role === 'user' ? 'text-right text-gray-500' : 'text-gray-600'}`}>
                    {formatTime(msg.timestamp)}
                  </p>
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FiUser size={14} className="text-white" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FiCpu size={14} className="text-cyan-400" />
                </div>
                <div className="bg-gray-800/60 rounded-2xl rounded-tl-md px-4 py-3">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {error && !loading && (
              <div className="text-center">
                <p className="text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 inline-block">{error}</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-700/50 flex flex-wrap gap-2">
              {attachments.map((att, i) => (
                <span key={i} className="flex items-center gap-1.5 bg-gray-800/80 rounded-lg px-2.5 py-1 text-xs text-gray-300">
                  {att.mime.startsWith('image/') ? '📷' : att.mime === 'application/pdf' ? '📄' : '🎥'}
                  <span className="truncate max-w-[120px]">{att.originalName}</span>
                  <button onClick={() => removeAttachment(i)} className="text-gray-500 hover:text-red-400 ml-1">
                    <FiX size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-4 py-3 border-t border-gray-700/50 bg-black/20">
            <div className="flex gap-2 items-end">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-gray-400 hover:text-cyan-400 hover:bg-gray-800/60 rounded-xl transition flex-shrink-0"
                title="Attach file"
              >
                <FiPaperclip size={18} />
              </button>
              <input ref={fileInputRef} type="file" multiple accept=".png,.jpg,.jpeg,.webp,.pdf,.mp4,.mpeg,.mov,.webm" onChange={handleFileSelect} className="hidden" />

              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything..."
                  rows={1}
                  className="w-full bg-gray-800/80 border border-gray-700/50 rounded-xl px-4 py-2.5 pr-12 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 transition"
                  style={{ minHeight: '42px', maxHeight: '120px' }}
                />
                <button
                  onClick={sendMessage}
                  disabled={loading || (!input.trim() && attachments.length === 0)}
                  className="absolute right-1.5 bottom-1.5 p-2 text-white bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg hover:from-cyan-400 hover:to-blue-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <FiSend size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bold: **text**
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
