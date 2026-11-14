import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRecorder } from '../js/voice.js';

class FakeRecorder {
  static isTypeSupported = type => type === 'audio/mp4';
  constructor(stream, opts) { this.stream = stream; this.opts = opts; this.state = 'inactive'; }
  start() { this.state = 'recording'; }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['abc'], { type: 'audio/mp4' }) });
    this.onstop?.();
  }
}

function devices({ deny = false } = {}) {
  const d = {
    lastStream: null,
    getUserMedia: async () => {
      if (deny) throw Object.assign(new Error('no'), { name: 'NotAllowedError' });
      const track = { stopped: false, stop() { this.stopped = true; } };
      d.lastStream = { getTracks: () => [track] };
      return d.lastStream;
    }
  };
  return d;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('createRecorder', () => {
  it('liefert Blob und Dauer', async () => {
    const r = createRecorder({ mediaDevices: devices(), Recorder: FakeRecorder });
    await r.start(); vi.advanceTimersByTime(5000);
    const out = await r.stop();
    expect(out.seconds).toBe(5);
    expect(out.blob.type).toBe('audio/mp4');
  });
  it('stoppt nach maxSeconds von selbst und gibt das Mikrofon frei', async () => {
    const d = devices();
    const ticks = [];
    const r = createRecorder({ maxSeconds: 120, mediaDevices: d, Recorder: FakeRecorder, onTick: s => ticks.push(s) });
    await r.start(); vi.advanceTimersByTime(125000);
    expect((await r.stop()).seconds).toBe(120);
    expect(d.lastStream.getTracks()[0].stopped).toBe(true);
    expect(ticks.at(-1)).toBe(120);
  });
  it('gibt das Mikrofon bei cancel frei und kennt danach keine Aufnahme mehr', async () => {
    const d = devices();
    const r = createRecorder({ mediaDevices: d, Recorder: FakeRecorder });
    await r.start(); r.cancel();
    expect(d.lastStream.getTracks()[0].stopped).toBe(true);
    await expect(r.stop()).rejects.toThrow('not-recording');
  });
  it('meldet abgelehnten Zugriff als mic-denied', async () => {
    const r = createRecorder({ mediaDevices: devices({ deny: true }), Recorder: FakeRecorder });
    await expect(r.start()).rejects.toThrow('mic-denied');
  });
  it('meldet fehlende Unterstuetzung als mic-unavailable', async () => {
    const r = createRecorder({ mediaDevices: devices(), Recorder: undefined });
    await expect(r.start()).rejects.toThrow('mic-unavailable');
  });
  it('meldet fehlendes audio/mp4 als mic-unavailable', async () => {
    class NoMp4 extends FakeRecorder { static isTypeSupported = () => false; }
    const r = createRecorder({ mediaDevices: devices(), Recorder: NoMp4 });
    await expect(r.start()).rejects.toThrow('mic-unavailable');
  });
});
