// Minimal Server-Sent Events hub keyed by user id plus the global feed.
// Used for real-time updates on the phone: any write broadcasts to listeners
// so the UI can refresh without polling.

export function createSseHub() {
  const clients = new Map(); // channel -> Set<Response>

  function subscribe(channel, res) {
    if (!clients.has(channel)) clients.set(channel, new Set());
    clients.get(channel).add(res);
    return () => clients.get(channel)?.delete(res);
  }

  function publish(channel, event, data) {
    const set = clients.get(channel);
    if (!set) return { subscribers: 0, written: 0 };
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    let written = 0;
    for (const res of set) {
      try {
        res.write(frame);
        written++;
      } catch {
        set.delete(res);
      }
    }
    return { subscribers: set.size, written };
  }

  function broadcast(event, data, channels) {
    for (const channel of channels) publish(channel, event, data);
  }

  return { subscribe, publish, broadcast, clients };
}
