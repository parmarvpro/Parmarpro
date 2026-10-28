import os, sys, urllib.request
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

SRC = "https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/Archivo%5Bwdth%2Cwght%5D.ttf"
OFL = "https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/OFL.txt"
OUT = "src/fonts"
os.makedirs(OUT, exist_ok=True)
ttf = os.path.join(OUT, "Archivo-VF.ttf")
urllib.request.urlretrieve(SRC, ttf)
urllib.request.urlretrieve(OFL, os.path.join(OUT, "OFL.txt"))

UNICODES = (
    list(range(0x20, 0x7F)) + list(range(0xA0, 0x100))
    + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2026,
       0x2190, 0x2191, 0x2192, 0x2193, 0x2212, 0x00D7, 0x2122, 0x20B9]
)
FEATURES = ["kern", "liga", "calt", "tnum", "lnum", "pnum", "case", "ccmp", "locl", "mark", "mkmk"]

font = TTFont(ttf)
assert 0x20B9 in font.getBestCmap(), "source font has no rupee sign"
font = instancer.instantiateVariableFont(font, {"wght": (300, 800), "wdth": (100, 125)})
opts = subset.Options()
opts.flavor = "woff2"
opts.layout_features = FEATURES
opts.notdef_outline = True
opts.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
opts.hinting = False
opts.desubroutinize = True
sub = subset.Subsetter(opts)
sub.populate(unicodes=UNICODES)
sub.subset(font)
assert 0x20B9 in font.getBestCmap(), "rupee sign lost while subsetting"
font.flavor = "woff2"
font.save(os.path.join(OUT, "archivo-var.woff2"))
os.remove(ttf)
size = os.path.getsize(os.path.join(OUT, "archivo-var.woff2"))
print(f"archivo-var.woff2: {size / 1024:.1f} KB")
assert size < 60 * 1024, "font grew past the 60 KB budget"
