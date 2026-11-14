// Sprachnotiz: Aufnahme (MediaRecorder, iOS nimmt audio/mp4 auf) und Wiedergabe.
const MIME = 'audio/mp4';
const AUDIO_BPS = 64000; // 120 s bleiben so weit unter dem 3-MB-Limit

/** true, wenn dieses WebView audio/mp4 aufnehmen kann (iOS ja, Desktop-Chrome nein). */
export const canRecord = (Recorder = globalThis.MediaRecorder) => !!Recorder?.isTypeSupported?.(MIME);

/**
 * Aufnahme-Steuerung. start() wirft 'mic-denied' oder 'mic-unavailable'. stop() liefert
 * { blob, seconds } und gibt das Mikrofon frei, auch nach dem Selbststopp bei maxSeconds.
 * cancel() verwirft alles und gibt das Mikrofon frei.
 */
export function createRecorder({
  maxSeconds = 120, mediaDevices = globalThis.navigator?.mediaDevices,
  Recorder = globalThis.MediaRecorder, onTick = () => {}
} = {}) {
  let stream = null, rec = null, timer = null, tick = null, startedAt = 0, finished = null;
  const chunks = [];

  const release = () => {
    clearTimeout(timer);
    clearInterval(tick);
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
  };
  const elapsed = () => Math.min(maxSeconds, Math.round((Date.now() - startedAt) / 1000));

  function finish() {
    if (!rec) return Promise.reject(new Error('not-recording'));
    finished ??= new Promise(resolve => {
      const seconds = elapsed();
      rec.onstop = () => {
        release();
        resolve({ blob: new Blob(chunks, { type: MIME }), seconds });
      };
      clearTimeout(timer);
      clearInterval(tick);
      if (rec.state !== 'inactive') rec.stop(); else rec.onstop();
    });
    return finished;
  }

  return {
    async start() {
      if (!canRecord(Recorder) || !mediaDevices?.getUserMedia) throw new Error('mic-unavailable');
      try {
        stream = await mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        throw new Error(e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'mic-denied' : 'mic-unavailable');
      }
      try {
        rec = new Recorder(stream, { mimeType: MIME, audioBitsPerSecond: AUDIO_BPS });
        rec.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
        rec.start();
      } catch {
        release();
        throw new Error('mic-unavailable');
      }
      startedAt = Date.now();
      tick = setInterval(() => onTick(elapsed()), 1000);
      timer = setTimeout(() => { onTick(maxSeconds); finish(); }, maxSeconds * 1000);
    },
    stop: finish,
    cancel() {
      if (rec) { rec.onstop = null; if (rec.state !== 'inactive') rec.stop(); }
      release();
      rec = null;
      chunks.length = 0;
    }
  };
}

/** Spielt eine fertige URL ab. toggle() muss direkt aus einem Tipp kommen (iOS). */
export function createPlayer(url, onState = () => {}) {
  const audio = new Audio(url);
  for (const ev of ['play', 'pause', 'ended']) audio.addEventListener(ev, () => onState(!audio.paused));
  return {
    toggle() { audio.paused ? audio.play().catch(() => onState(false)) : audio.pause(); },
    stop() { audio.pause(); audio.removeAttribute('src'); audio.load(); }
  };
}
