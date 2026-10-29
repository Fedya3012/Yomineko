// Browser glue for shadowing: microphone recording, capturing the original line, optional speech-to-text.
// Kept apart from shadowing.ts (pure maths) because none of this can run outside a real browser.
import type { Cue } from './subtitles';

export interface Pcm { samples: Float32Array; sampleRate: number }

export async function decodeToPcm(blob: Blob): Promise<Pcm> {
  const ctx = new AudioContext({ sampleRate: 16000 });
  try {
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const out = new Float32Array(buf.length);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < out.length; i++) out[i] += ch[i] / buf.numberOfChannels;
    }
    return { samples: out, sampleRate: buf.sampleRate };
  } finally {
    void ctx.close();
  }
}

function recordStream(stream: MediaStream): { stop: () => Promise<Blob> } {
  const rec = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<Blob>((res) => (rec.onstop = () => res(new Blob(chunks, { type: rec.mimeType }))));
  rec.start();
  return { stop: () => { if (rec.state !== 'inactive') rec.stop(); return done; } };
}

/** Record the learner. `heard` resolves with a transcript when the browser supports it, else ''. */
export async function recordLearner(lang = 'ja-JP') {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: true } });
  const rec = recordStream(stream);
  const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
  let heard = Promise.resolve('');
  let recognizer: any;
  if (SR) {
    recognizer = new SR();
    recognizer.lang = lang;
    recognizer.interimResults = false;
    heard = new Promise<string>((res) => {
      let text = '';
      recognizer.onresult = (e: any) => { for (const r of e.results) text += r[0].transcript; };
      recognizer.onend = () => res(text);
      recognizer.onerror = () => res(text);
    });
    try { recognizer.start(); } catch { /* already running */ }
  }
  return {
    async stop() {
      try { recognizer?.stop(); } catch { /* ignore */ }
      const blob = await rec.stop();
      stream.getTracks().forEach((t) => t.stop());
      return { blob, heard: await Promise.race([heard, new Promise<string>((r) => setTimeout(() => r(''), 1500))]) };
    }
  };
}

/** Play one subtitle line from the learner's own video and capture its audio (the "model" to shadow).
 *  Returns null if the browser cannot capture audio from a video element. */
export async function captureCueAudio(video: HTMLVideoElement, cue: Cue): Promise<Blob | null> {
  const capture = (video as any).captureStream ?? (video as any).mozCaptureStream;
  if (!capture) return null;
  const stream: MediaStream = capture.call(video);
  const audio = new MediaStream(stream.getAudioTracks());
  if (!audio.getAudioTracks().length) return null;
  video.currentTime = cue.start;
  await new Promise<void>((r) => { video.onseeked = () => r(); setTimeout(r, 1000); });
  const rec = recordStream(audio);
  await video.play();
  await new Promise<void>((resolve) => {
    const tick = () => (video.currentTime >= cue.end || video.paused || video.ended ? resolve() : requestAnimationFrame(tick));
    tick();
  });
  video.pause();
  return rec.stop();
}
