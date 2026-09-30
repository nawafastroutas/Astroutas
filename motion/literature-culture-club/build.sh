#!/usr/bin/env bash
# Builds everything into out/:
#   video-16x9.mp4  (1920×1080, 60 fps, with sound)   video-16x9-silent.mp4
#   video-9x16.mp4  (1080×1920, 60 fps, with sound)   video-9x16-silent.mp4
# Needs node, Playwright (Chromium) and an ffmpeg with libx264 (set FFMPEG=/path/to/ffmpeg if not on PATH).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out

node synth.js out/soundtrack.wav

node render.js --size 1920x1080 --fps 60 --out out/video-16x9-silent.mp4
node mux.js out/video-16x9-silent.mp4 out/soundtrack.wav out/video-16x9.mp4

node render.js --size 1080x1920 --fps 60 --out out/video-9x16-silent.mp4
node mux.js out/video-9x16-silent.mp4 out/soundtrack.wav out/video-9x16.mp4
