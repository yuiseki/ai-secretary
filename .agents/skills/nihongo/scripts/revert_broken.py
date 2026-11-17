#!/usr/bin/env python3
"""直した文のうち、意味が変わったかもしれない文だけを原文の文に戻す。

使い方:
    python3 revert_broken.py 原文.md 直した文.md 出力.md [--request 依頼.md]

--request には、ユーザーの依頼文を保存したファイルを渡す。依頼の中に出てくる値
（伏せるよう頼まれた番号、変えるよう頼まれた日時など）は、頼まれた直しとして戻さない。

check_meaning.py と同じ基準で原文と直した文を比べ、候補が出た所について、
原文の該当する文と、直した文の中でいちばん近い文を探し、その文を原文の文に置き換える。
原文の文が直した文から丸ごと消えている時は、近い位置に原文の文を差し込む。
候補が無くなるか、それ以上減らなくなるまで繰り返す（最大6回）。

標準ライブラリだけで動く。戻した文は一覧で出す。
"""
import difflib
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from check_meaning import check, norm, MODALITY, NEG  # noqa: E402

SENT = re.compile(r"[^。！？!?\n]+[。！？!?]?")


def spans(text):
    return [(m.start(), m.end(), m.group()) for m in SENT.finditer(text) if m.group().strip()]


def sim(a, b):
    return difflib.SequenceMatcher(None, norm(a), norm(b)).ratio()


def is_heading(t):
    return bool(re.match(r"\s*#+\s", t)) or (len(t.strip()) < 25 and not re.search(r"[。！？!?]$", t.strip()) and t.strip().startswith("**"))


def best(sent, cands):
    """cands の中で sent にいちばん近いものの番号と近さ。見出しの行は相手にしない。"""
    scores = [0.0 if is_heading(c[2]) else sim(sent, c[2]) for c in cands]
    if not scores:
        return None, 0.0
    i = max(range(len(scores)), key=scores.__getitem__)
    return i, scores[i]


def words_of(item):
    """候補の行から、原文の文を探すための手がかりの語を取り出す。"""
    m = re.match(r"\[(数値・日時|曜日|コード|URL)\] 原文にあって直した文で減ったもの: (.*)", item)
    if m:
        return [x.strip() for x in m.group(2).split(", ") if x.strip()], "lost"
    m = re.match(r"\[確かさ・強さ\] 「(.+?)」の言い方が(減った|増えた)", item)
    if m:
        return MODALITY[m.group(1)], ("lost" if m.group(2) == "減った" else "added")
    m = re.match(r"\[程度・約束\] 「(.+?)」が減った", item)
    if m:
        return [m.group(1)], "lost"
    m = re.match(r"\[(数値・日時|曜日|コード|URL)\] 直した文で増えたもの: (.*)", item)
    if m:
        return [x.strip() for x in m.group(2).split(", ") if x.strip()], "added"
    if item.startswith("[否定]"):
        return None, "neg"
    m = re.match(r"\[組み合わせ\] 「(.+?)」", item)
    if m:
        return [m.group(1)], "pair"
    m = re.match(r"\[消えた中身\] 中身の言葉が半分以上見当たらない文: (.*)", item)
    if m:
        return m.group(1), "gone"
    return None, None


PREFIX = re.compile(r"^\s*(?:\*\*[^*\n]+\*\*[:：]?\s*|[-*・]\s+|#+\s+|\d+[.)]\s+)")


def fit(orig, place):
    """原文の文を戻す時、行頭の見出し・箇条書きの記号は、置き換える先に合わせる。"""
    body = PREFIX.sub("", orig, count=1).strip()
    m = PREFIX.match(place)
    return (m.group(0) if m else "") + body


def has(s, ws):
    s = norm(s)
    return any(w in s for w in ws)


def one_pass(src, dst, request=""):
    """候補を1つずつ見て、戻す文を決めて置き換える。戻した記録も返す。"""
    S, D = spans(src), spans(dst)
    req = norm(request)
    owner = [best(s[2], D)[0] for s in S]  # 原文の各文が、直した文のどの文にいちばん近いか
    replace = {}   # 直した文の番号 → 置き換える原文の文
    insert = []    # (直した文の番号の後ろ, 原文の文)
    used = set()   # 戻すのに使った原文の文

    def put(i, sent):
        if i in replace or sent in used:
            return
        # 原文の2文以上を1文にまとめた文なら、まとめた元の文を全部戻す（片方だけ戻して中身を落とさない）
        group = [s[2] for k, s in enumerate(S) if owner[k] == i and s[2] not in used]
        if sent not in group:
            group = [sent]
        replace[i] = "".join(group)
        used.update(group)

    def add(p, sent):
        if sent not in used:
            insert.append((p, sent))
            used.add(sent)
    for item in check(src, dst):
        ws, kind = words_of(item)
        if req and kind in ("lost", "added") and ws:
            ws = [w for w in ws if norm(w) not in req]  # 依頼に出てくる値は、頼まれた直しなので戻さない
            if not ws:
                continue
        if kind == "pair":
            for s in S:
                if ws[0] in s[2]:
                    i, sc = best(s[2], D)
                    if i is not None and sc >= 0.45 and ws[0] in D[i][2]:
                        put(i, s[2])
            continue
        if kind in ("lost", "neg"):
            for s in S:
                if kind == "lost" and not has(s[2], ws):
                    continue
                i, sc = best(s[2], D)
                if i is None or sc < 0.45:
                    continue
                if kind == "lost" and has(D[i][2], ws):
                    continue
                if kind == "neg" and len(NEG.findall(norm(s[2]))) == len(NEG.findall(norm(D[i][2]))):
                    continue
                put(i, s[2])
        elif kind == "added":
            for i, d in enumerate(D):
                if not has(d[2], ws):
                    continue
                j, sc = best(d[2], S)
                if j is not None and not has(S[j][2], ws):
                    put(i, S[j][2])
        elif kind == "gone":
            s = next((x for x in S if x[2].strip().startswith(ws[:20])), None)
            if s is None:
                continue
            k = S.index(s)
            prev = best(S[k - 1][2], D)[0] if k > 0 else None
            add(prev, s[2])
    if not replace and not insert:
        return dst, []
    log = []
    out, last = [], 0
    ins_after = {}
    for p, s in insert:
        ins_after.setdefault(p, []).append(s)
    if None in ins_after:
        for s in ins_after[None]:
            if s.strip() not in dst:
                out.append(PREFIX.sub("", s, count=1).strip() + "\n\n")
                log.append(f"差し込んだ：{s.strip()[:50]}")
    for i, (a, b, t) in enumerate(D):
        out.append(dst[last:a])
        if i in replace:
            out.append(fit(replace[i], t))
            log.append(f"戻した：{t.strip()[:30]} → {replace[i].strip()[:30]}")
        else:
            out.append(t)
        for s in ins_after.get(i, []):
            if s.strip() not in dst:
                out.append(PREFIX.sub("", s, count=1).strip())
                log.append(f"差し込んだ：{s.strip()[:50]}")
        last = b
    out.append(dst[last:])
    return "".join(out), log


def main():
    args = sys.argv[1:]
    request = ""
    if "--request" in args:
        k = args.index("--request")
        request = open(args[k + 1], encoding="utf-8").read()
        del args[k:k + 2]
    if len(args) != 3:
        print(__doc__)
        sys.exit(2)
    src = open(args[0], encoding="utf-8").read()
    dst = open(args[1], encoding="utf-8").read()
    logs = []
    n = len(check(src, dst))
    for _ in range(6):
        new, log = one_pass(src, dst, request)
        m = len(check(src, new))
        if not log or m >= n:
            break
        dst, n = new, m
        logs += log
    with open(args[2], "w", encoding="utf-8") as f:
        f.write(dst)
    if logs:
        print(f"{len(logs)}か所を原文に戻しました。")
        for x in logs:
            print("- " + x)
    else:
        print("戻した所はありません。")
    rest = check(src, dst)
    if rest:
        print(f"残っている候補が{len(rest)}件あります（読み比べて、同じ意味ならそのままでよい）：")
        for x in rest:
            print("- " + x)


if __name__ == "__main__":
    main()
