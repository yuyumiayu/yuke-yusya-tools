"""scripts/raw_sheet.py（ゆけ!勇者 @ ウィキを転記した表）を data/*.json に変換する"""
import pathlib, sys
R = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(R/"scripts"))
import json, re
from raw_sheet import WEAPONS, ARMORS, ITEMS
KEYS = ["hp","atk","def","eva","luk"]
isnum = lambda t: re.fullmatch(r"-?\d+", t) is not None

def take_stats(tok, i):
    txt = []
    while not isnum(tok[i]): txt.append(tok[i]); i += 1
    vals = [int(x) for x in tok[i:i+5]]
    assert all(isnum(x) for x in tok[i:i+5]), tok
    return (",".join(t for t in txt if t != "-") or None), dict(zip(KEYS, vals)), i+5

def split_prices(nums):
    # 「1,000」のようにカンマで割れた数値を、売値=価格/10 になる分け方で復元
    for k in range(1, len(nums)):
        p, s = int("".join(nums[:k])), int("".join(nums[k:]))
        if s * 10 == p and all(len(x) == 3 for x in nums[1:k]) and all(len(x) == 3 for x in nums[k+1:]):
            return p, s
    raise ValueError(nums)

def rarity(t): return int(t.replace("☆", ""))

def equip(raw, power_key):
    out = []
    for line in raw.splitlines():
        tok = line.split(",")
        r, name, power, mx = rarity(tok[0]), tok[1], int(tok[2]), int(tok[3])
        btxt, base, i = take_stats(tok, 4)
        gtxt, growth, i = take_stats(tok, i)
        rest = tok[i:]
        j = len(rest)
        while isnum(rest[j-1]): j -= 1
        words, price_toks = rest[:j], rest[j:]
        price, sell = split_prices(price_toks)
        ability, dung = (words[0], words[1]) if len(words) == 2 else (None, words[0])
        out.append({
            "rarity": r, "name": name, power_key: power, "max_enhance": mx,
            "base_text": btxt, "base": base,
            "growth_text": gtxt, "growth": growth,
            "ability": ability,
            "dungeons": [dung] if dung in ("イベント限定",) else list(dung),
            "price": price, "sell_price": sell,
        })
    return out

def items(raw):
    out = []
    for line in raw.splitlines():
        tok = line.split(",")
        name = tok[0]
        btxt, base, i = take_stats(tok, 1)
        gtxt, growth, i = take_stats(tok, i)
        j = i
        while isnum(tok[j]): j += 1
        price, sell = split_prices(tok[i:j])
        dungeons, r = tok[j:-1], rarity(tok[-1])
        out.append({"rarity": r, "name": name, "base_text": btxt, "base": base,
                    "growth_text": gtxt, "growth": growth,
                    "dungeons": dungeons, "price": price, "sell_price": sell})
    return out

W = equip(WEAPONS, "base_attack")
A = equip(ARMORS, "base_defense")
unk = lambda: dict.fromkeys(KEYS, None)
W.append({"rarity":2,"name":"ふるびた剣2","base_attack":None,"max_enhance":None,"base_text":None,
          "base":{"hp":0,"atk":None,"def":0,"eva":0,"luk":0},"growth_text":None,"growth":unk(),
          "ability":None,"dungeons":[],"price":5000,"sell_price":500,"note":"元データ不明(？)、注記*12"})
A.append({"rarity":2,"name":"ふるびた鎧2","base_defense":None,"max_enhance":None,"base_text":None,
          "base":{"hp":0,"atk":0,"def":None,"eva":0,"luk":0},"growth_text":None,"growth":unk(),
          "ability":None,"dungeons":[],"price":5000,"sell_price":500,"note":"元データ不明(？)、注記*7"})
I = items(ITEMS)
for fn, d in [("weapons.json", W), ("armors.json", A), ("items.json", I)]:
    json.dump(d, open(R/"data"/fn, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(fn, len(d))
