import { useEffect, useRef, useState } from 'react';
import type { RealtimeEvent, WinFeedItem } from '@nexus/shared';
import { API_URL } from './api';

function wsUrl(): string {
  if (API_URL) return `${API_URL.replace(/^http/, 'ws')}/ws`;
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws`;
}

/**
 * Живая лента выигрышей.
 * WebSocket с переподключением; если канал недоступен — вызывающий код
 * продолжает работать на обычном опросе /api/wins.
 */
export function useWinFeed(initial: WinFeedItem[] = []): { wins: WinFeedItem[]; online: number; connected: boolean } {
  const [wins, setWins] = useState<WinFeedItem[]>(initial);
  const [online, setOnline] = useState(0);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const seeded = useRef(false);

  // Первые данные приходят из HTTP-запроса и не должны затираться при ре-рендере
  useEffect(() => {
    if (!seeded.current && initial.length > 0) {
      seeded.current = true;
      setWins(initial);
    }
  }, [initial]);

  useEffect(() => {
    let closed = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const connect = (): void => {
      if (closed) return;

      try {
        const socket = new WebSocket(wsUrl());
        socketRef.current = socket;

        socket.onopen = () => {
          attempt = 0;
          setConnected(true);
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data as string) as RealtimeEvent;
            if (message.type === 'win') {
              setWins((current) => [message.payload, ...current].slice(0, 20));
            } else if (message.type === 'online') {
              setOnline(message.payload.count);
            }
          } catch {
            // Некорректное сообщение игнорируем
          }
        };

        socket.onclose = () => {
          setConnected(false);
          if (closed) return;
          // Экспоненциальная задержка с потолком — не долбим сервер
          attempt += 1;
          retry = setTimeout(connect, Math.min(1000 * 2 ** attempt, 15_000));
        };

        socket.onerror = () => socket.close();
      } catch {
        retry = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socketRef.current?.close();
    };
  }, []);

  return { wins, online, connected };
}
