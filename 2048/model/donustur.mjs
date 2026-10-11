// 2048 AI Laboratuvarı — eğitilmiş modeli (ntuple.bin, float32, 256 MB) siteye uygun hale getirir.
//
//   node 2048/model/donustur.mjs <ntuple.bin> [çıkış klasörü = bu klasör]
//
// Ağırlıklar 16 bit tam sayıya çevrilir (ölçek = en büyük |ağırlık| / 32767, en büyük hata ~2 puan) ve her desen
// ayrı bir gzip parçası olur (~13 MB). Rust kıyaslama aracıyla ölçüldü: güç orijinalle aynı
// (derinlik 2, 150 oyun: 16384 oranı %96,7 → %96,0; ortalama skor farkı ölçüm gürültüsü içinde).
// 8 bitlik sürümler denendi ama modeli belirgin şekilde zayıflatıyor (16384 oranı %14'e kadar düşüyor).
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [src, outArg] = process.argv.slice(2);
if (!src) {
  console.error('kullanım: node 2048/model/donustur.mjs <ntuple.bin> [çıkış klasörü]');
  process.exit(1);
}
const out = outArg || dirname(fileURLToPath(import.meta.url));
const buf = readFileSync(src);

// ---- başlık (trainer/src/main.rs > save_model ile aynı düzen) ----
if (buf.toString('latin1', 0, 4) !== 'N2TW') throw new Error('N2TW model dosyası değil');
const version = buf.readUInt32LE(4);
const nPat = buf.readUInt32LE(8);
const tupleLen = buf.readUInt32LE(12);
const games = Number(buf.readBigUInt64LE(16));
const seconds = buf.readDoubleLE(24);
const stages = version >= 2 ? buf.readUInt32LE(32) : 1;
const stageExp = version >= 2 ? buf.readUInt32LE(36) : 0;
const patAt = version >= 2 ? 40 : 32;
const patterns = [];
for (let p = 0; p < nPat; p++) patterns.push([...buf.subarray(patAt + p * tupleLen, patAt + (p + 1) * tupleLen)]);
const offset = Math.ceil((patAt + nPat * tupleLen) / 4) * 4;
const per = 16 ** tupleLen;
const count = stages * nPat * per;
if (offset + count * 4 > buf.length) throw new Error('model dosyası eksik');
const w = new Float32Array(buf.buffer.slice(buf.byteOffset + offset, buf.byteOffset + offset + count * 4));

// ---- 16 bit ----
let amax = 0;
for (let i = 0; i < count; i++) { const a = Math.abs(w[i]); if (a > amax) amax = a; }
const scale = amax / 32767;
const q = new Int16Array(count);
for (let i = 0; i < count; i++) q[i] = Math.round(w[i] / scale);

// ---- her desen (ve aşama) ayrı parça ----
const parts = [];
for (let k = 0; k < stages * nPat; k++) {
  const raw = Buffer.from(q.buffer, k * per * 2, per * 2);
  const gz = gzipSync(raw, { level: 9 });
  const file = `w${k}.i16.gz`;
  writeFileSync(join(out, file), gz);
  parts.push({ file, offset: k * per, count: per, bytes: gz.length });
  console.log(`${file}: ${(gz.length / 1048576).toFixed(1)} MB`);
}

const manifest = {
  format: 'n2tw-i16', version, nPat, tupleLen, games, seconds, stages, stageExp, patterns,
  scale, count, parts, source: { bytes: buf.length },
};
writeFileSync(join(out, 'ntuple16.json'), `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`ntuple16.json · ölçek ${scale} · toplam ${(parts.reduce((a, p) => a + p.bytes, 0) / 1048576).toFixed(1)} MB`);
