# ゆけ！勇者 ツール集

スマホゲーム「ゆけ！勇者」の装備づくりに使う計算ツールです。ブラウザだけで動きます。

**非公式のファンツールです。** ゲーム「ゆけ！勇者」および開発元の [xHachiApps](https://yukeyusha1.xhachi.com/index.html) とは関係ありません。
計算結果には推測を含み、正確さは保証しません。

## ツール

公開ページ：https://yuyumiayu.github.io/yuke-yusya-tools/

| ツール | できること |
|---|---|
| [成長予測](https://yuyumiayu.github.io/yuke-yusya-tools/yuke-calc.html) | 武器・防具・道具から Lv1〜99 のステータスと鍛錬の森4Fの点数を出す。合成・共鳴・出発時レベルに対応。ベストな組み合わせの総当たりもできる。 |
| [強化屋](https://yuyumiayu.github.io/yuke-yusya-tools/yuke-enhance.html) | 同じ装備2つで強化したときの結果を、期待値・上振れ・強化屋Lvごとの違いで見る。進行中の強化の上振れ・下振れの確認、目標に届く素材の逆引きもできる。 |

選んだ内容は、使っているブラウザの中（localStorage）にだけ保存されます。

## 開発

必要なもの：Node.js（テスト）と Python 3（組み立て）。外部のライブラリは使っていません。

```
npm test         # 全ツールのテスト
npm run build    # dist/ に各ツールの単一HTMLを作る（ブラウザで直接開ける）
```

```
data/          装備・道具・共鳴・強化のデータ（JSON）
src/common/    全ツール共通の見た目（base.css）とフッター
src/calc/      成長予測（engine.js：計算、search.js：総当たり、ui.js：画面、template.html）
src/enhance/   強化屋（engine.js：計算、ui.js：画面とグラフ、template.html）
src/index/     ツール一覧
scripts/       データの変換（raw_*.py → data/*.json）と組み立て（build_html.py）
tests/         テスト
docs/          計算の仕様（仕様.md）と実機での確認表
```

計算の仕様・データの説明・推測で決めたことは [docs/仕様.md](docs/仕様.md) にまとめています。

## 協力のお願い

データの間違い・不具合・要望は [Issue](../../issues) へ。直し方が分かる場合は Pull Request も歓迎します。
進め方は [CONTRIBUTING.md](CONTRIBUTING.md) を見てください。

## ライセンスとデータの出典

- プログラムは [MIT ライセンス](LICENSE) です。
- 武器（[一覧](https://w.atwiki.jp/yukeyuu/pages/13.html)）・防具（[一覧](https://w.atwiki.jp/yukeyuu/pages/14.html)）・アイテム（[一覧](https://w.atwiki.jp/yukeyuu/pages/19.html)）の数値、共鳴、合成屋・強化屋の仕様、鍛錬の森の採点基準は [ゆけ!勇者 @ ウィキ](https://w.atwiki.jp/yukeyuu/) が出典で、MIT ライセンスの対象外です。詳しくは [NOTICE.md](NOTICE.md)。
