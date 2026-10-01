#!/bin/sh
# مقارنة «قبل/بعد» جنبًا إلى جنب. النسختان لهما الخط الزمني نفسه بالضبط،
# فأي فرق تراه في إطارٍ واحد هو فرق الحركة لا فرق التوقيت.
#
#   sh compare/build-compare.sh motion   subha-motion
#   sh compare/build-compare.sh gifting  subha-gifting
set -e
NAME="$1"; OUT="$2"
DIR="$(dirname "$0")"
V1="$DIR/v1-$NAME.mp4"
V2="$DIR/../output/$OUT-1080x1920.mp4"
[ -f "$V1" ] || { echo "مفقود: $V1"; exit 1; }
[ -f "$V2" ] || { echo "مفقود: $V2"; exit 1; }

ffmpeg -y -loglevel error -i "$V1" -i "$V2" -filter_complex "
  [0:v]scale=620:1102,pad=620:1172:0:70:0x14110E,
       drawtext=fontfile=$DIR/../fonts/Outfit-Bold.ttf:text='BEFORE':
                fontcolor=0x9C8E7C:fontsize=30:x=(w-tw)/2:y=24[a];
  [1:v]scale=620:1102,pad=620:1172:0:70:0x14110E,
       drawtext=fontfile=$DIR/../fonts/Outfit-Bold.ttf:text='AFTER':
                fontcolor=0xB9955C:fontsize=30:x=(w-tw)/2:y=24[b];
  [a][b]hstack=inputs=2,pad=1256:1172:8:0:0x14110E[v];
  [0:a][1:a]amerge=inputs=2,pan=stereo|c0=c0|c1=c3[aud]
" -map "[v]" -map "[aud]" \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p \
  -c:a aac -b:a 160k -movflags +faststart \
  "$DIR/compare-$NAME.mp4"

echo "✓ compare/compare-$NAME.mp4"
