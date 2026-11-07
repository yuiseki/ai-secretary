# 出典・注意事項

本skillは以下2つを典拠とする派生物である。

## (a) 論理の層の出典: ja-text-communication (MIT License)

- 取得元: https://github.com/mathbullet/skills (PUBLIC, MIT License)
- 取得コミット: fe96c626b39abba47fad2d4a4ef738e8a27602b1 (2026-08-02)
- 取得パス: `plugins/ja-text-communication/skills/ja-text-communication/`
- 本skillでの利用: 「論理の層」節で、製品ドキュメント本文にも適用できる条項(A/B/C/D/E/F系列の一部)を引用・要約した。G/H系列(エージェントの作業報告・対話向け)は対象外とした。

MIT Licenseの原文(著作権表示):

```text
MIT License

Copyright (c) 2026 mathbullet

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

本skill自体は上記MITの条件に従う派生物として、Geoloniaの社内リポジトリ(private)に置く。ja-text-communication本体(`.claude/skills/ja-text-communication`)は上流との同期のため無改変のまま別途据え置いており、本skillはそれとは別物である。

## (b) 表記の層の典拠: Microsoft Japanese Localization Style Guide (著作物・転記不可)

- 出典: Microsoft Localization Style Guide for Japanese, `https://aka.ms/japanese-styleguide`
- 取得日: 2026-09-04
- 実体: `jpn-jpn-StyleGuide.pdf`、約1.28MB、71ページ、HTTP 200で一般公開されている文書
- 性質: Microsoft製品を日本語へローカライズする担当者向けの表記規則集(Localization Style Guide)であり、一般的な技術文書の書き方指南ではない

**★取り扱い方針**: この文書はMicrosoftの著作物であり、MITのような再配布許可のあるライセンスではない。したがって「表記の層」節では、原文の文章・表の内容を**転記せず**、docs.geolonia.comに関係する項目(全角半角・数字・記号・カタカナ長音・体言止めの使い分け)を読み、その趣旨をGeoloniaの言葉で規則化し直した。原文を直接読みたい場合は上記URLを参照すること。

参考情報(Microsoft社が案内する著作物利用について、規則本文中に記載されている参照先):
- “マイクロソフトの著作物の使用について” https://www.microsoft.com/ja-jp/mscorp/legal/intellectualproperty-permissions.aspx
