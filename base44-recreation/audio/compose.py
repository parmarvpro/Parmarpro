"""Synthesize the music bed for the film and mix it under the voiceover.

Everything is generated from scratch with numpy/scipy (no samples):
117 BPM, F# minor, structured around the film's chapters and cuts.

usage: python compose.py vo.wav out_dir
writes out_dir/music.wav and out_dir/soundtrack.wav (48 kHz stereo)
"""
import sys
import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000
DUR = 51.7
N = int(DUR * SR)
BPM = 117.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(44)


def t_axis(n):
    return np.arange(n) / SR


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def env_adsr(n, a, d, s, r, total_hold=None):
    """simple ADSR in seconds; total length n samples"""
    e = np.ones(n)
    A, D, R = int(a * SR), int(d * SR), int(r * SR)
    A = max(A, 1)
    e[:A] = np.linspace(0, 1, A)
    if D > 0:
        e[A:A + D] = np.linspace(1, s, min(D, max(0, n - A)))[: max(0, min(D, n - A))]
    e[A + D:] = s
    if R > 0 and n > R:
        e[-R:] *= np.linspace(1, 0, R)
    return e


def lowpass(x, fc, order=2):
    sos = signal.butter(order, fc / (SR / 2), btype='low', output='sos')
    return signal.sosfilt(sos, x)


def highpass(x, fc, order=2):
    sos = signal.butter(order, fc / (SR / 2), btype='high', output='sos')
    return signal.sosfilt(sos, x)


def bandpass(x, f1, f2, order=2):
    sos = signal.butter(order, [f1 / (SR / 2), f2 / (SR / 2)], btype='band', output='sos')
    return signal.sosfilt(sos, x)


def place(buf, x, t0, gain=1.0):
    s = int(t0 * SR)
    if s >= len(buf):
        return
    e = min(len(buf), s + len(x))
    if s < 0:
        x = x[-s:]
        s = 0
    buf[s:e] += gain * x[: e - s]


def gate(t0, t1, fade=0.08):
    """0..1 envelope over the whole film"""
    t = t_axis(N)
    return np.clip(np.minimum((t - t0) / fade, (t1 - t) / fade), 0, 1)


# ---------------------------------------------------------------- harmony
CHORDS = [  # (pad voicing, bass root) — F#m · D · A · E, two bars each
    ([54, 57, 61, 66], 42),
    ([50, 54, 57, 62], 38),
    ([52, 57, 61, 64], 45),
    ([52, 56, 59, 64], 40),
]


def chord_at(t):
    i = int(t // (2 * BAR)) % len(CHORDS)
    return CHORDS[i]


# ---------------------------------------------------------------- instruments
def saw_voice(freq, n, harmonics=14, detune_cents=(-7, 0, 7)):
    t = t_axis(n)
    out = np.zeros(n)
    for dc in detune_cents:
        f = freq * 2 ** (dc / 1200)
        ph = rng.uniform(0, 2 * np.pi)
        for k in range(1, harmonics + 1):
            if f * k > 9000:
                break
            out += np.sin(2 * np.pi * f * k * t + ph * k) / k
    return out / len(detune_cents)


def pad_track():
    L = np.zeros(N)
    R = np.zeros(N)
    seg = 2 * BAR
    k = 0
    t0 = 0.0
    while t0 < DUR:
        notes, _ = CHORDS[k % 4]
        n = int((seg + 0.6) * SR)
        v = np.zeros(n)
        for m in notes:
            v += saw_voice(midi(m), n)
        v = lowpass(v, 1400, 2) * env_adsr(n, 0.35, 0.0, 1.0, 0.7)
        # gentle stereo spread
        place(L, v, t0, 0.55)
        place(R, np.roll(v, int(0.011 * SR)), t0, 0.55)
        t0 += seg
        k += 1
    return L, R


def kick(n=int(0.42 * SR)):
    t = t_axis(n)
    f = 46 + 110 * np.exp(-t * 26)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7.5)
    click = rng.normal(0, 1, n) * np.exp(-t * 400) * 0.25
    return np.tanh(1.6 * (body + click))


def clap(n=int(0.3 * SR)):
    t = t_axis(n)
    noise = rng.normal(0, 1, n)
    e = np.zeros(n)
    for d in (0.0, 0.011, 0.022):
        e += np.exp(-np.clip(t - d, 0, None) * 60) * (t >= d)
    e += 0.3 * np.exp(-t * 14)
    return bandpass(noise, 900, 4200) * e * 0.6


def hat(n=int(0.07 * SR), open_=False):
    t = t_axis(n if not open_ else int(0.22 * SR))
    noise = rng.normal(0, 1, len(t))
    return highpass(noise, 7500, 2) * np.exp(-t * (55 if not open_ else 16)) * 0.35


def bass_note(m, n):
    t = t_axis(n)
    f = midi(m)
    x = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sign(np.sin(2 * np.pi * f * t))
    x = lowpass(x, 700, 2)
    return x * env_adsr(n, 0.004, 0.12, 0.65, 0.05)


def pluck(m, n=int(0.45 * SR)):
    t = t_axis(n)
    f = midi(m)
    x = np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t + 0.3) + 0.08 * np.sin(2 * np.pi * 3 * f * t)
    return x * np.exp(-t * 9) * (1 - np.exp(-t * 900))


def riser(length):
    n = int(length * SR)
    t = t_axis(n)
    noise = rng.normal(0, 1, n)
    out = np.zeros(n)
    # sweep a band upward in 16 slices
    slices = 24
    for i in range(slices):
        a, b = i * n // slices, (i + 1) * n // slices
        fc = 300 * (24 ** (i / slices))
        seg = bandpass(noise, fc * 0.7, min(fc * 1.6, 20000), 2)[a:b]
        out[a:b] = seg
    amp = (t / length) ** 2.2
    tone = np.sin(2 * np.pi * np.cumsum(220 + 660 * (t / length) ** 2) / SR) * 0.15
    return (out * 0.8 + tone) * amp


def impact(length=2.6):
    n = int(length * SR)
    t = t_axis(n)
    boom = np.sin(2 * np.pi * np.cumsum(38 + 70 * np.exp(-t * 9)) / SR) * np.exp(-t * 2.4)
    hiss = lowpass(rng.normal(0, 1, n), 2400) * np.exp(-t * 3.5) * 0.35
    return np.tanh(1.4 * (boom + hiss))


def whoosh(length=0.45, up=True):
    n = int(length * SR)
    t = t_axis(n)
    noise = rng.normal(0, 1, n)
    shape = np.sin(np.pi * t / length) ** 2
    out = np.zeros(n)
    slices = 12
    for i in range(slices):
        a, b = i * n // slices, (i + 1) * n // slices
        p = i / slices if up else 1 - i / slices
        fc = 500 * (12 ** p)
        out[a:b] = bandpass(noise, fc * 0.6, min(fc * 1.8, 20000))[a:b]
    return out * shape * 0.5


def reverb_ir(seconds=1.8, seed=3):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = t_axis(n)
    ir = r.normal(0, 1, n) * np.exp(-t * 3.2)
    ir = lowpass(ir, 6000)
    ir[: int(0.012 * SR)] = 0
    return ir / np.sqrt(np.sum(ir ** 2))


def verb(x, seconds=1.8, seed=3):
    return signal.fftconvolve(x, reverb_ir(seconds, seed))[: len(x)]


# ---------------------------------------------------------------- arrangement
def beats_between(t0, t1, every=1.0, offset=0.0):
    out = []
    b = np.ceil((t0 - offset * BEAT) / (every * BEAT))
    while True:
        t = (b * every + offset) * BEAT
        if t >= t1:
            break
        if t >= t0:
            out.append(t)
        b += 1
    return out


def build():
    t = t_axis(N)

    # sections (mirrors the energy map of the original spot)
    FULL = [(0.2, 4.15), (4.4, 19.4), (29.9, 38.1), (38.56, 48.85)]
    HALF = [(19.45, 26.35), (27.92, 29.9)]
    BREAKS = [(4.15, 4.4), (26.35, 27.92), (38.1, 38.56), (48.85, 50.27)]

    # pad bed — thin, high-passed, louder only in the breaks / ending
    pl, pr = pad_track()
    pl, pr = highpass(pl, 180), highpass(pr, 180)
    pad_gain = 0.22 + sum(0.3 * gate(a, b, 0.12) for a, b in BREAKS[1:]) + 0.15 * gate(4.15, 4.4, 0.08) + 0.4 * gate(50.27, 52, 0.2)

    # kick: four on the floor in FULL, half-time in HALF; sidechain from it
    K = np.zeros(N)
    side = np.ones(N)
    kk = kick()

    def hit(bt, g=0.95):
        place(K, kk, bt, g)
        s0 = int(bt * SR)
        dn = int(0.3 * SR)
        if s0 < N:
            seg = 1 - 0.5 * np.exp(-np.arange(min(dn, N - s0)) / SR * 9)
            side[s0:s0 + len(seg)] = np.minimum(side[s0:s0 + len(seg)], seg)

    for a, b in FULL:
        for bt in beats_between(a, b):
            hit(bt)
    for a, b in HALF:
        for bt in beats_between(a, b, every=2.0):
            hit(bt, 0.85)

    # claps on 2 & 4
    CL = np.zeros(N)
    cp = clap()
    for a, b in [(4.4, 19.4), (29.9, 38.1), (38.56, 45.9)]:
        for bt in beats_between(a, b, every=2.0, offset=1.0):
            place(CL, cp, bt, 0.75)
    for a, b in HALF:
        for bt in beats_between(a, b, every=4.0, offset=3.0):
            place(CL, cp, bt, 0.6)

    # hats: bright 8ths everywhere except the breaks, 16ths in the busiest stretches
    H = np.zeros(N)
    hh = hat()
    oh = hat(open_=True)
    for a, b in FULL + HALF:
        for bt in beats_between(a, b, every=0.5):
            off = abs((bt / BEAT) % 1 - 0.5) < 1e-6
            place(H, oh if off and int(bt / BEAT) % 4 == 3 else hh, bt, 1.0 if off else 0.55)
    for a, b in [(12.45, 19.4), (29.9, 38.1), (42.9, 48.85)]:
        for bt in beats_between(a, b, every=0.25, offset=0.25):
            if abs((bt / BEAT) % 0.5 - 0.25) < 1e-6:
                place(H, hh, bt, 0.35)

    # bass: driving 8ths in FULL, staccato hits on the beat in HALF
    B = np.zeros(N)
    for a, b in FULL:
        for i, bt in enumerate(beats_between(a, b, every=0.5)):
            _, root = chord_at(bt)
            m = root + (12 if i % 8 in (3, 7) else 0)
            place(B, bass_note(m, int(0.5 * BEAT * SR * 0.85)), bt, 0.75)
    for a, b in HALF:
        for bt in beats_between(a, b, every=1.0):
            _, root = chord_at(bt)
            place(B, bass_note(root, int(0.22 * SR)), bt, 0.8)

    # arpeggio plucks (16ths) with a dotted-eighth echo on the other side
    AL = np.zeros(N)
    AR = np.zeros(N)
    pattern = [0, 2, 1, 3, 2, 1, 3, 2]
    for a, b, g in [(0.2, 4.15, 0.24), (19.45, 26.35, 0.3), (36.42, 45.9, 0.24)]:
        for i, bt in enumerate(beats_between(a, b, every=0.25)):
            notes, _ = chord_at(bt)
            p = pluck(notes[pattern[i % 8] % len(notes)] + 12)
            place(AL if i % 2 == 0 else AR, p, bt, g)
            place(AR if i % 2 == 0 else AL, p * 0.5, bt + 0.75 * BEAT, g)

    # risers into the big cuts, impacts on them
    FX = np.zeros(N)
    # risers stop just short of the cut so they never mask the first consonant of a line
    for t1, length, g in [(4.4, 1.2, 0.3), (12.45, 1.0, 0.25), (19.45, 1.0, 0.28), (27.92, 1.5, 0.32), (50.27, 1.3, 0.26)]:
        r = riser(length)
        f = int(0.12 * SR)
        r[-f:] *= np.linspace(1, 0, f) ** 2
        place(FX, r, t1 - length - 0.06, g)
    for t0, g in [(4.4, 0.2), (19.45, 0.4), (27.92, 0.5), (38.56, 0.3), (50.27, 0.32)]:
        place(FX, lowpass(impact(), 900), t0 - 0.14, g)
    WH = np.zeros(N)
    for t0 in [1.45, 7.5, 9.46, 10.96, 11.96, 12.96, 13.46, 15.96, 17.46, 21.62, 24.52, 25.92, 33.98, 36.46, 37.46, 39.46, 40.96, 42.96, 44.46, 45.96, 49.2, 49.96]:
        place(WH, whoosh(0.4, up=True), t0 - 0.28, 0.2)

    # ---- mix
    pad_l = pl * pad_gain * (0.6 + 0.4 * side)
    pad_r = pr * pad_gain * (0.6 + 0.4 * side)
    bass = B * side
    hats_l = highpass(H, 6000) * 0.8
    hats_r = np.roll(hats_l, int(0.004 * SR))
    dry_l = pad_l + bass + K + CL * 0.55 + hats_l + AL + FX * 0.8 + WH
    dry_r = pad_r + bass + K + CL * 0.55 + hats_r + AR + FX * 0.8 + WH
    wet_l = pad_l * 0.3 + CL * 0.35 + AL * 0.6 + FX * 0.5 + WH * 0.5
    wet_r = pad_r * 0.3 + CL * 0.35 + AR * 0.6 + FX * 0.5 + WH * 0.5
    L = dry_l + 0.32 * verb(wet_l, 1.7, 3)
    R = dry_r + 0.32 * verb(wet_r, 1.7, 7)
    tail = np.clip((DUR - t) / 0.9, 0, 1)
    head = np.clip(t / 0.03, 0, 1)
    return np.stack([L * tail * head, R * tail * head], 1)


def follower(x, attack=0.01, release=0.25):
    a = np.exp(-1 / (attack * SR))
    r = np.exp(-1 / (release * SR))
    env = np.zeros_like(x)
    lvl = 0.0
    ax = np.abs(x)
    for i in range(0, len(x), 64):
        v = ax[i:i + 64].max()
        lvl = a * lvl + (1 - a) * v if v > lvl else r * lvl + (1 - r) * v
        env[i:i + 64] = lvl
    return env


def main(vo_path, out_dir):
    music = build()
    music /= np.max(np.abs(music)) + 1e-9
    sf.write(f'{out_dir}/music.wav', (music * 0.89).astype(np.float32), SR)

    vo, sr = sf.read(vo_path, dtype='float32')
    assert sr == SR
    if vo.ndim > 1:
        vo = vo.mean(1)
    vo = np.pad(vo, (0, max(0, N - len(vo))))[:N]
    vo = highpass(vo, 80)
    # duck the music under the voice
    env = follower(vo)
    env = np.maximum(env, np.roll(env, -int(0.08 * SR)))  # look-ahead so consonant onsets stay clear
    duck = 1 - 0.5 * np.clip(env / (np.max(env) * 0.25 + 1e-9), 0, 1)
    mix = music * (0.46 * duck)[:, None] + vo[:, None] * 0.9
    mix = np.tanh(1.15 * mix) / np.tanh(1.15)
    mix /= np.max(np.abs(mix)) + 1e-9
    sf.write(f'{out_dir}/soundtrack.wav', (mix * 0.93).astype(np.float32), SR)
    print('ok', mix.shape)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
