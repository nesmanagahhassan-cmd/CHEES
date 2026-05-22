import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, limit } from 'firebase/firestore';
import { Send, MessageSquare, ShieldAlert, Award } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Message } from '../types';

interface ChessChatProps {
  roomId: string;
  userId: string;
  userName: string;
  isOffline?: boolean;
}

export default function ChessChat({ roomId, userId, userName, isOffline = false }: ChessChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync Messages from Firestore Realtime Snapshot
  useEffect(() => {
    if (isOffline) {
      // Offline mock commentary
      setMessages([
        {
          id: 'init',
          userId: 'system',
          userName: 'الحكم الرقمي 🤖',
          text: 'مرحباً بك في المواجهة المحلية! تبادل الحديث أو سجل ملاحظاتك التكتيكية هنا.',
          timestamp: new Date().toISOString()
        }
      ]);
      return;
    }

    const messagesRef = collection(db, 'rooms', roomId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(50));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({
          id: doc.id,
          userId: data.userId || '',
          userName: data.userName || 'مجهول',
          text: data.text || '',
          timestamp: data.timestamp?.toDate()?.toISOString() || new Date().toISOString()
        });
      });
      setMessages(list);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `rooms/${roomId}/messages`);
    });

    return unsubscribe;
  }, [roomId, isOffline]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const currentText = text;
    setText('');

    if (isOffline) {
      // offline push to state
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          userId,
          userName,
          text: currentText,
          timestamp: new Date().toISOString()
        }
      ]);
      return;
    }

    try {
      const messagesRef = collection(db, 'rooms', roomId, 'messages');
      await addDoc(messagesRef, {
        userId,
        userName,
        text: currentText,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-blue-500" />
        <div>
          <h4 className="text-sm font-semibold text-slate-100">رادار الغرفة والمحادثة المباشرة</h4>
          <p className="text-[10px] text-slate-400">تحدث مع المنافس والمشاهدين مباشرة</p>
        </div>
      </div>

      {/* Messages viewport */}
      <div className="flex-grow p-4 overflow-y-auto space-y-4 max-h-[350px] min-h-[220px]">
        {messages.map((msg) => {
          const isMe = msg.userId === userId;
          const isSystem = msg.userId === 'system';

          if (isSystem) {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[11px] text-blue-300 flex items-center gap-1.5 max-w-[85%]">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>{msg.text}</span>
                </div>
              </div>
            );
          }

          if (msg.userId === 'game_alert') {
            return (
              <div key={msg.id} className="flex justify-center">
                <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 flex items-center gap-1.5 max-w-[85%]">
                  <Award className="w-3.5 h-3.5" />
                  <span>{msg.text}</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-1.5 mb-1 px-1">
                <span className="text-[10px] text-slate-400 font-medium">
                  {isMe ? 'أنت' : msg.userName}
                </span>
                <span className="text-[8px] text-slate-600 font-mono">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs break-words leading-relaxed ${
                  isMe
                    ? 'bg-blue-600 text-white rounded-tr-none'
                    : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/50'
                }`}
              >
                {msg.text}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Controls form */}
      <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
        <input
          id="chat_input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="اكتب رسالة تكتيكية هنا..."
          className="flex-grow bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        <button
          id="btn_send_chat"
          type="submit"
          disabled={!text.trim()}
          className="p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all disabled:opacity-40 disabled:hover:bg-blue-600"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
