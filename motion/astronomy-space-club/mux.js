#!/usr/bin/env node
/*
 * Adds the soundtrack to a rendered (silent) video.
 * Two-pass EBU R128 loudness normalisation → -16 LUFS, true peak ≤ -1.5 dBTP
 * (a comfortable level for Instagram / WhatsApp / YouTube), AAC 192 kb/s.
 *
 *   node mux.js out/silent-1920x1080.mp4 out/soundtrack.wav out/video-16x9.mp4
 */
const { execFileSync, spawnSync } = require('child_process');
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const [video, audio, out] = process.argv.slice(2);
if (!out) { console.error('usage: node mux.js <video.mp4> <audio.wav> <out.mp4>'); process.exit(1); }

// pass 1: measure (ffmpeg prints the loudnorm report as JSON on stderr)
const target = 'I=-16:TP=-1.5:LRA=11';
const report = spawnSync(FFMPEG, ['-hide_banner', '-i', audio, '-af', `loudnorm=${target}:print_format=json`, '-f', 'null', '-'],
                         { encoding: 'utf8' }).stderr;
const m = JSON.parse(report.match(/\{[^{}]*\}/g).pop());
// pass 2: apply linearly and mux
const af = `loudnorm=${target}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}` +
           `:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=48000,` +
           `alimiter=limit=0.79:attack=2:release=60:level=false`;   // keep AAC true peak under -1 dBTP
execFileSync(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', '-i', video, '-i', audio,
  '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-af', af, '-c:a', 'aac', '-b:a', '192k',
  '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
console.log(`${out}  (audio in: ${m.input_i} LUFS → -16 LUFS)`);
