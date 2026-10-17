import sys, json, numpy as np, soundfile as sf, sherpa_onnx, librosa
K, out = sys.argv[1], sys.argv[2]
SR = 48000
cfg = sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
    model=f"{K}/model.onnx", voices=f"{K}/voices.bin", tokens=f"{K}/tokens.txt", data_dir=f"{K}/espeak-ng-data",
    dict_dir=f"{K}/dict", lexicon=f"{K}/lexicon-us-en.txt,{K}/lexicon-zh.txt"), num_threads=4), max_num_sentences=1)
tts = sherpa_onnx.OfflineTts(cfg)
SID = 17  # am_onyx
LINES = [
    (0.05, "Your clients dream big."), (1.52, "Your agency builds bigger."), (4.40, "Base forty-four."),
    (8.16, "Build it all."), (9.52, "Give your clients what others don't."), (12.88, "Unlimited by your title."),
    (15.28, "Your agency can move faster."), (17.60, "Go further."), (19.52, "Expand."),
    (21.84, "Build tools wired into your stack."), (27.44, "Automate."), (32.24, "Ban redundancy."),
    (38.56, "Every skill, multiply."), (42.88, "Every hour,"), (44.88, "worth more."),
    (46.72, "You don't need to reinvent yourself."), (49.04, "It's already done."), (50.32, "Base forty-four."),
]
total = int(52.5 * SR)
mix = np.zeros(total, dtype=np.float32)
report = []
for i, (t0, text) in enumerate(LINES):
    limit = (LINES[i + 1][0] - t0 - 0.08) if i + 1 < len(LINES) else 2.0
    speed = 1.0
    for _ in range(6):
        a = tts.generate(text, sid=SID, speed=speed)
        y = np.array(a.samples, dtype=np.float32)
        y = librosa.resample(y, orig_sr=a.sample_rate, target_sr=SR)
        y, _ = librosa.effects.trim(y, top_db=38)
        dur = len(y) / SR
        if dur <= limit: break
        speed *= min(1.25, dur / limit + 0.02)
    # 8ms fades
    f = int(0.008 * SR)
    y[:f] *= np.linspace(0, 1, f); y[-f:] *= np.linspace(1, 0, f)
    s = int(t0 * SR)
    mix[s:s + len(y)] += y[: max(0, min(len(y), total - s))]
    report.append((t0, text, round(dur, 2), round(speed, 2), round(limit, 2)))
peak = np.max(np.abs(mix))
mix = mix / peak * 0.89
sf.write(f"{out}/vo.wav", mix, SR)
for r in report: print(r)
