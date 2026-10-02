"""scripts/raw_enhance.py（強化上限値・費用の表）を data/enhance.json に変換する"""
import json, pathlib, sys
R = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(R / "scripts"))
from raw_enhance import ENHANCE

ALIAS = {"鬼の金棒": "オニの金棒", "鬼のパンツ": "オニのパンツ"}   # 元の表の表記 → マスタの名前
# 元の表に行がないもの。費用は他の装備と同じく「価格の半分」と推測
MISSING = {"端午の鎧": {"kind": "armor", "note": "wiki に費用が載っていないため、価格の半分と推測"}}
NOTES = {"漆黒の鎧": "費用は wiki の値。ほかの装備と同じ規則（価格の半分）なら 40,000G"}

masters = {"weapon": json.load(open(R / "data/weapons.json", encoding="utf-8")),
           "armor": json.load(open(R / "data/armors.json", encoding="utf-8"))}
by_name = {k: {x["name"]: x for x in v} for k, v in masters.items()}

out, kind = [], "weapon"
rows = [l.split("\t") for l in ENHANCE.splitlines()]
for i, (name, mx, cost) in enumerate(rows):
    if name == "名称":
        if i > 0: kind = "armor"
        continue
    if name == "-" or mx == "？": continue                        # 空き行・ふるびた剣/鎧（不明）
    name = ALIAS.get(name, name)
    m = by_name[kind][name]
    assert int(mx) == m["max_enhance"], (name, mx, m["max_enhance"])
    d = {"kind": kind, "name": name, "max": int(mx), "cost": int(cost)}
    if name in NOTES: d["note"] = NOTES[name]
    out.append(d)
for name, v in MISSING.items():
    m = by_name[v["kind"]][name]
    out.append({"kind": v["kind"], "name": name, "max": m["max_enhance"], "cost": m["price"] // 2, "note": v["note"]})

json.dump(out, open(R / "data/enhance.json", "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("enhance.json", len(out), "weapons", sum(x["kind"] == "weapon" for x in out), "armors", sum(x["kind"] == "armor" for x in out))
