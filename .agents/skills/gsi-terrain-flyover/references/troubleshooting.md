# 困ったとき

| 症状 | 原因と対処 |
|---|---|
| `page.screenshot: Timeout 30000ms exceeded` | ソフトウェア描画 (SwiftShader) で地形が重すぎる。起動時の `webgl:` 行を見る。NVIDIA でなければ GPU の引数が効いていない。`FLYOVER_GL` が設定されていないか確かめる |
| `webgl:` が SwiftShader になる | `--use-gl=angle --use-angle=gl-egl` が必要。`--enable-gpu` だけでは SwiftShader のまま (2026-11-11 に確かめた)。SSH の X 転送の `DISPLAY` が残っていると WebGL が固まるので、`render.mjs` はブラウザに渡す環境から `DISPLAY` を外している |
| `warning: N frame(s) were captured before all tiles loaded` | 20 秒待ってもタイルが読み終わらなかった。回線かタイルのサーバーが遅い。もう一度流す。ずっと続くなら、カメラが遠すぎて読むタイルが多すぎる (zoom を上げるか pitch を下げる) |
| ラベルが地形とずれた所に出る | 地図の座標を画面に写すのは、タイルを読み終えてから (地形の高さが要る)。`frame()` は地図を待ってから DOM の重ね物を置いている。自分で順番を変えたらずれる |
| `image` や `base` が地形の上に出ない | MapLibre 5.24 は、地形の上のラスタを地形のタイルごとの描き置きに描いていて、透明度や表示の切り替えでは描き直さない (freeRtt を呼んでも出なかった)。`frame()` は、ラスタの重ね物の透明度が前のコマと違うときに地形を入れ直している。消すと出なくなる |
| 年が「1,969」になる | `counter` に `"grouping": false` |
| 静止画の一覧に関係ないコマが混ざる | 前の書き出しのコマが残っていた。`render.mjs` は書き出しの前に `frames/` を消す |
| 海に針のような山が立つ | 標高の値なし (RGB 128,0,0) を 0 m にしていない。`gsidem` プロトコルを通しているか確かめる |
| 遠くが白くかすむ / 空が出ない | `sky` の設定。`fog-ground-blend` を上げると霧が遠くに下がる。pitch が 60 度より浅いと空は見えない |
| 日本語が豆腐 (□) になる | 日本語フォントが無い。`fc-list :lang=ja` で確かめ、Noto Sans CJK JP を入れる (`page/flyover.css` の `--font`) |
| `VOICEVOX audio_query failed` | エンジンが動いていない。`curl http://127.0.0.1:50021/version`。Docker なら `docker start voicevox-engine` |
| `unknown voice "x"` | `lines` の `voice` が `voices` に無い。`voice` を省略すると `voices` の最初の声 |
| 音量が -14 LUFS からずれる | 2 段階の loudnorm でも、ピーク (-1.5 dBTP) を守るため少し下がる。実測 -14.5。声だけのときも BGM ありでも同じだった |
| 一部だけ書き出すと音が無い | `--from`/`--to` は画だけ。声は通しで書き出したときに重ねる |
| 地平線の近くに暗い欠け | タイルの無い所に背景色が出ている。背景色は霧の色 (`sky` の `fog-color`) にしてある |
