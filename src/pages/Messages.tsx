import { useEffect, useState } from 'react';
import { Radio, Send, Megaphone } from 'lucide-react';
import { client } from '../data/client';
import { useAuth } from '../context/AuthContext';
import type { Message, MessageChannelKey } from '../types/message';

const CHANNELS: { key: MessageChannelKey; label: string }[] = [
  { key: 'OPS', label: 'Ops' },
  { key: 'SECURITY', label: 'Security' },
  { key: 'STEWARDS', label: 'Stewards' },
  { key: 'MEDICAL', label: 'Medical' },
];

/**
 * Text-based backup to the DMR radio plan — for when radio traffic is
 * saturated, a handset's lost/flat, or a written record beats a verbal
 * one. Channel-based only (no 1:1 direct messages), so communication
 * doesn't fragment. OPS is broadcast: event-control/fmic post, everyone
 * reads — enforced client-side only (see the note in amplify/data/resource.ts,
 * same documented limitation as the Level 4 lock).
 */
export function Messages() {
  const { user } = useAuth();
  const [channel, setChannel] = useState<MessageChannelKey>('OPS');
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await client.models.Message.list({ filter: { channel: { eq: channel } } });
      if (!cancelled) {
        setMessages((data as unknown as Message[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      }
    }
    load();

    const sub = client.models.Message.onCreate({ filter: { channel: { eq: channel } } }).subscribe({
      next: (msg) => setMessages((prev) => [...prev, msg as unknown as Message]),
    });
    return () => {
      cancelled = true;
      sub.unsubscribe();
    };
  }, [channel]);

  if (!user) return null;

  if (user.role === 'view-only') {
    return (
      <p style={{ padding: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
        View Only accounts don't have access to messaging.
      </p>
    );
  }

  const canPost = channel !== 'OPS' || user.role === 'event-control' || user.role === 'fmic';

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !canPost) return;
    setSending(true);
    try {
      await client.models.Message.create({
        channel,
        text: text.trim(),
        senderId: user.userId,
        senderName: user.name,
        senderRole: user.role,
      });
      setText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)' }}>
      <h1 style={{ fontSize: 'var(--text-lg)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Radio size={20} /> Messages
      </h1>

      <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', marginBottom: 'var(--space-3)' }}>
        {CHANNELS.map((c) => (
          <button
            key={c.key}
            type="button"
            className={channel === c.key ? '' : 'secondary'}
            onClick={() => setChannel(c.key)}
            style={{ minHeight: 36, padding: '0 var(--space-3)', fontSize: 'var(--text-sm)' }}
          >
            {c.key === 'OPS' && <Megaphone size={13} style={{ marginRight: 6, verticalAlign: -2 }} />}
            {c.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', paddingBottom: 'var(--space-3)' }}>
        {messages.length === 0 && (
          <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)' }}>No messages on this channel yet.</p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{
              border: '1px solid var(--color-border)',
              borderLeft: m.channel === 'OPS' ? '3px solid var(--color-brand)' : '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-2) var(--space-3)',
              background: m.channel === 'OPS' ? 'var(--color-surface)' : 'var(--color-surface-raised)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>
              <span>
                <strong style={{ color: 'var(--color-text-primary)' }}>{m.senderName}</strong> · {m.senderRole}
              </span>
              <span className="mono">{new Date(m.createdAt).toLocaleTimeString('en-GB')}</span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 'var(--text-sm)' }}>{m.text}</p>
          </div>
        ))}
      </div>

      {canPost ? (
        <form onSubmit={send} style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Message ${CHANNELS.find((c) => c.key === channel)?.label}…`}
            aria-label="Message text"
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={sending || !text.trim()} aria-label="Send message">
            <Send size={16} />
          </button>
        </form>
      ) : (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'center' }}>
          Ops is a broadcast channel — only Event Control/FMIC can post here.
        </p>
      )}
    </div>
  );
}
