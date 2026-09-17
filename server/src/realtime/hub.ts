import type { RealtimeEvent } from '@nexus/shared';

interface Client {
  send: (data: string) => void;
}

/**
 * Простейшая шина событий для живой ленты выигрышей.
 * Держит подключения в памяти: при нескольких инстансах сервера
 * достаточно заменить реализацию на Redis pub/sub, интерфейс не изменится.
 */
class RealtimeHub {
  private clients = new Set<Client>();

  add(client: Client): () => void {
    this.clients.add(client);
    this.send(client, { type: 'hello', payload: { serverTime: new Date().toISOString() } });
    this.broadcastOnline();
    return () => {
      this.clients.delete(client);
      this.broadcastOnline();
    };
  }

  get size(): number {
    return this.clients.size;
  }

  broadcast(event: RealtimeEvent): void {
    const data = JSON.stringify(event);
    for (const client of this.clients) {
      try {
        client.send(data);
      } catch {
        // Мёртвое соединение не должно ронять рассылку остальным
        this.clients.delete(client);
      }
    }
  }

  private broadcastOnline(): void {
    this.broadcast({ type: 'online', payload: { count: this.clients.size } });
  }

  private send(client: Client, event: RealtimeEvent): void {
    try {
      client.send(JSON.stringify(event));
    } catch {
      this.clients.delete(client);
    }
  }
}

export const hub = new RealtimeHub();
