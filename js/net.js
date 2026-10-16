// اللعب عبر الإنترنت: اتصال مباشر بين المتصفحات (WebRTC عبر PeerJS)
// المضيف هو المركز: يستقبل رسائل كل لاعب ويعيد بثها للبقية.
const PREFIX = 'rimal-race-';

function peerOptions() {
  const q = new URLSearchParams(location.search);
  const opts = {
    debug: 1,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ],
    },
  };
  // خادم PeerJS خاص (اختياري): ?peerhost=example.com&peerport=443&peersecure=1
  if (q.get('peerhost')) {
    opts.host = q.get('peerhost');
    opts.port = +(q.get('peerport') || 443);
    opts.secure = q.get('peersecure') !== '0';
    opts.path = q.get('peerpath') || '/';
  }
  return opts;
}

export function makeCode() {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

export class Net {
  constructor() {
    this.peer = null;
    this.isHost = false;
    this.conns = new Map(); // للمضيف: معرف اللاعب -> الاتصال
    this.hostConn = null;   // للعميل
    this.id = null;
    this.code = null;
    this.onMessage = () => {};
    this.onJoin = () => {};
    this.onLeave = () => {};
    this.onDisconnect = () => {};
  }

  get online() { return !!this.peer; }

  host() {
    return new Promise((resolve, reject) => {
      const tryOpen = (attempt) => {
        const code = makeCode();
        const peer = new Peer(PREFIX + code, peerOptions());
        let opened = false;
        peer.on('open', (id) => {
          opened = true;
          this.peer = peer; this.isHost = true; this.id = id; this.code = code;
          resolve(code);
        });
        peer.on('connection', (conn) => this.acceptConn(conn));
        peer.on('error', (err) => {
          if (!opened && err.type === 'unavailable-id' && attempt < 4) { peer.destroy(); tryOpen(attempt + 1); return; }
          if (!opened) { peer.destroy(); reject(err); return; }
          console.warn('peer error', err);
        });
        peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
      };
      tryOpen(0);
    });
  }

  acceptConn(conn) {
    conn.on('open', () => {
      this.conns.set(conn.peer, conn);
      this.onJoin(conn.peer);
    });
    conn.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      msg.from = conn.peer; // لا نثق بالمرسل
      // إعادة البث لبقية اللاعبين
      if (msg.relay) {
        for (const [id, c] of this.conns) if (id !== conn.peer && c.open) c.send(msg);
      }
      this.onMessage(msg);
    });
    const gone = () => {
      if (!this.conns.has(conn.peer)) return;
      this.conns.delete(conn.peer);
      this.onLeave(conn.peer);
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  join(code) {
    return new Promise((resolve, reject) => {
      const peer = new Peer(peerOptions());
      let done = false;
      const timer = setTimeout(() => { if (!done) { done = true; peer.destroy(); reject(new Error('timeout')); } }, 15000);
      peer.on('open', (id) => {
        this.peer = peer; this.id = id; this.code = code;
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        conn.on('open', () => {
          if (done) return;
          done = true; clearTimeout(timer);
          this.hostConn = conn;
          resolve();
        });
        conn.on('data', (msg) => { if (msg && typeof msg === 'object') this.onMessage(msg); });
        conn.on('close', () => this.onDisconnect());
        conn.on('error', () => this.onDisconnect());
      });
      peer.on('error', (err) => {
        if (!done) { done = true; clearTimeout(timer); peer.destroy(); reject(err); }
        else console.warn('peer error', err);
      });
      peer.on('disconnected', () => { if (!peer.destroyed) peer.reconnect(); });
    });
  }

  // إرسال للجميع (المضيف) أو للمضيف ليعيد بثه (العميل)
  send(msg, relay = true) {
    msg.from = this.id;
    if (relay) msg.relay = 1;
    if (this.isHost) {
      for (const c of this.conns.values()) if (c.open) c.send(msg);
    } else if (this.hostConn && this.hostConn.open) {
      this.hostConn.send(msg);
    }
  }

  sendTo(id, msg) {
    const c = this.conns.get(id);
    if (c && c.open) { msg.from = this.id; c.send(msg); }
  }

  close() {
    if (this.peer) this.peer.destroy();
    this.peer = null; this.conns.clear(); this.hostConn = null; this.isHost = false;
  }
}
