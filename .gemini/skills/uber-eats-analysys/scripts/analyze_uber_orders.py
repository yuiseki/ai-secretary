#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import html
import json
import re
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
WORKSPACE_DIR = SCRIPT_DIR.parents[3]
DEFAULT_WORKDIR = WORKSPACE_DIR / ".ai-secretary" / "uber-analysis"
DEFAULT_DETAIL_DIR = WORKSPACE_DIR / ".ai-secretary" / "uber_eats_data"
DEFAULT_WINDOWS_DAYS = [7, 30]
WEEKDAY_ORDER = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3, "Fri": 4, "Sat": 5, "Sun": 6}

SCRIPT_STYLE_RE = re.compile(r"(?is)<(script|style)[^>]*>.*?</\1>")
TAG_RE = re.compile(r"(?is)<[^>]+>")
SPACE_RE = re.compile(r"[ \t\f\v]+")
NEWLINE_RE = re.compile(r"\n+")

TOTAL_PATTERNS = [
    re.compile(r"合計\s*(?:金額)?\s*[¥￥]\s*([0-9][0-9,]*)"),
    re.compile(r"total\s*[¥￥]\s*([0-9][0-9,]*)", re.IGNORECASE),
    re.compile(r"[¥￥]\s*([0-9][0-9,]*)\s*(?:合計|total)", re.IGNORECASE),
]

STORE_PATTERNS = [
    re.compile(r"([^\n]{2,100})の領収書をお受け取りください"),
    re.compile(r"([^\n]{2,100})の領収書"),
    re.compile(r"receipt from ([^\n]{2,100})", re.IGNORECASE),
    re.compile(r"receipt for ([^\n]{2,100})", re.IGNORECASE),
]

ORDER_KEYWORDS = (
    "ご注文",
    "注文内容",
    "完了した注文",
    "領収書をお受け取りください",
    "Uber Eats",
)

NON_ORDER_HINTS = (
    "利用規約",
    "プライバシー",
    "セキュリティ",
    "アカウント",
    "規約改定",
)


def html_to_text(body: str) -> str:
    s = body or ""
    s = s.replace("\r", "\n")
    s = SCRIPT_STYLE_RE.sub(" ", s)
    s = re.sub(r"(?i)<br\s*/?>", "\n", s)
    s = re.sub(r"(?i)</(p|div|tr|td|li|h1|h2|h3|h4|h5|h6)>", "\n", s)
    s = TAG_RE.sub(" ", s)
    s = html.unescape(s).replace("\xa0", " ")
    s = SPACE_RE.sub(" ", s)
    s = re.sub(r" *\n *", "\n", s)
    s = NEWLINE_RE.sub("\n", s)
    return s.strip()


def parse_int(text: str | None) -> int | None:
    if not text:
        return None
    cleaned = text.replace(",", "").strip()
    return int(cleaned) if cleaned.isdigit() else None


def extract_total_yen(text: str) -> int | None:
    for pat in TOTAL_PATTERNS:
        m = pat.search(text)
        if m:
            value = parse_int(m.group(1))
            if value is not None:
                return value
    all_amounts = [parse_int(v) for v in re.findall(r"[¥￥]\s*([0-9][0-9,]*)", text)]
    all_amounts = [v for v in all_amounts if v is not None]
    return max(all_amounts) if all_amounts else None


def clean_store_name(name: str) -> str:
    s = re.sub(r"\s+", " ", name).strip(" .,-:;")
    s = s.replace("結衣様、ご注文いただきありがとうございます", "").strip()
    if len(s) > 100:
        s = s[:100].strip()
    return s


def extract_store_name(text: str) -> str:
    for pat in STORE_PATTERNS:
        m = pat.search(text)
        if not m:
            continue
        store = clean_store_name(m.group(1))
        if store and "Uber" not in store:
            return store
    return ""


def looks_like_order(subject: str, text: str, total_yen: int | None) -> bool:
    if total_yen is None:
        return False
    combined = f"{subject}\n{text}"
    has_order_keyword = any(k in combined for k in ORDER_KEYWORDS)
    has_non_order_hint = any(k in combined for k in NON_ORDER_HINTS)
    if has_order_keyword:
        return True
    if has_non_order_hint:
        return False
    return "領収書" in combined


def parse_mail_datetime(s: str) -> datetime | None:
    try:
        return datetime.strptime(s, "%Y-%m-%d %H:%M")
    except Exception:
        return None


def parse_iso_to_local_naive(s: str) -> datetime | None:
    if not s:
        return None
    try:
        raw = s.strip()
        if raw.endswith("Z"):
            raw = raw[:-1] + "+00:00"
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            return dt
        return dt.astimezone().replace(tzinfo=None)
    except Exception:
        return None


def parse_detail_total_yen(total_price_raw: Any) -> int:
    if total_price_raw is None:
        return 0
    try:
        # ubereats.com scraped payload uses 100x scale (e.g. 146000 -> 1460 JPY).
        return int(round(float(total_price_raw) / 100.0))
    except Exception:
        return 0


def format_item_titles(items: list[dict[str, Any]]) -> str:
    parts = []
    for item in items:
        title = str(item.get("title", "")).strip()
        quantity = int(item.get("quantity", 1))
        if not title:
            continue
        if quantity > 1:
            parts.append(f"{title} x{quantity}")
        else:
            parts.append(title)
    return " | ".join(parts)


def load_detail_rows(detail_dir: Path) -> tuple[list[dict[str, Any]], list[str]]:
    rows: list[dict[str, Any]] = []
    source_files = sorted(detail_dir.glob("uber_eats_*.json"))

    for path in source_files:
        with path.open("r", encoding="utf-8") as f:
            payload = json.load(f)

        data = payload.get("data", {}) if isinstance(payload, dict) else {}
        orders_map = data.get("ordersMap", {}) if isinstance(data, dict) else {}
        if not isinstance(orders_map, dict):
            continue

        for order in orders_map.values():
            if not isinstance(order, dict):
                continue
            base = order.get("baseEaterOrder", {}) if isinstance(order.get("baseEaterOrder"), dict) else {}
            if not base.get("isCompleted", False):
                continue

            completed_at_utc = str(base.get("completedAt") or base.get("lastStateChangeAt") or "")
            dt = parse_iso_to_local_naive(completed_at_utc)

            store_info = order.get("storeInfo", {}) if isinstance(order.get("storeInfo"), dict) else {}
            store_name = str(store_info.get("title") or "").strip() or "(unknown)"

            fare_info = order.get("fareInfo", {}) if isinstance(order.get("fareInfo"), dict) else {}
            total_yen = parse_detail_total_yen(fare_info.get("totalPrice"))

            shopping_cart = base.get("shoppingCart", {}) if isinstance(base.get("shoppingCart"), dict) else {}
            raw_items = shopping_cart.get("items", []) if isinstance(shopping_cart.get("items"), list) else []
            items: list[dict[str, Any]] = []
            for raw_item in raw_items:
                if not isinstance(raw_item, dict):
                    continue
                title = str(raw_item.get("title") or "").strip()
                if not title:
                    continue
                try:
                    quantity = int(raw_item.get("quantity", 1))
                except Exception:
                    quantity = 1
                items.append({"title": title, "quantity": max(1, quantity)})

            total_quantity = sum(int(item["quantity"]) for item in items)
            rows.append(
                {
                    "order_uuid": str(base.get("uuid") or ""),
                    "completed_at_utc": completed_at_utc,
                    "mail_dt": dt,
                    "mail_date": dt.strftime("%Y-%m-%d %H:%M") if dt else "",
                    "year_month": dt.strftime("%Y-%m") if dt else "",
                    "weekday": dt.strftime("%a") if dt else "",
                    "hour": dt.strftime("%H") if dt else "",
                    "store_name": store_name,
                    "total_yen": total_yen,
                    "item_count_distinct": len(items),
                    "item_count_total": total_quantity,
                    "item_titles": format_item_titles(items),
                    "items": items,
                    "source_file": path.name,
                }
            )

    rows.sort(
        key=lambda r: r["mail_dt"] if isinstance(r.get("mail_dt"), datetime) else datetime.min,
        reverse=True,
    )
    return rows, [str(p) for p in source_files]


def write_detail_orders_csv(detail_rows: list[dict[str, Any]], out_path: Path) -> None:
    fieldnames = [
        "order_uuid",
        "completed_at_utc",
        "mail_date",
        "store_name",
        "total_yen",
        "item_count_distinct",
        "item_count_total",
        "item_titles",
        "source_file",
    ]
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows([{k: r.get(k, "") for k in fieldnames} for r in detail_rows])


def build_detail_item_rankings(
    detail_rows: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    item_orders = Counter()
    item_quantity = Counter()
    store_item_quantity = Counter()

    for row in detail_rows:
        store_name = str(row.get("store_name", "(unknown)"))
        for item in row.get("items", []):
            title = str(item.get("title", "")).strip()
            if not title:
                continue
            quantity = int(item.get("quantity", 1))
            item_orders[title] += 1
            item_quantity[title] += quantity
            store_item_quantity[(store_name, title)] += quantity

    items_by_quantity_rows = [
        {
            "item_title": title,
            "orders": item_orders[title],
            "quantity": item_quantity[title],
        }
        for title, _ in item_quantity.most_common()
    ]

    items_by_orders_rows = [
        {
            "item_title": title,
            "orders": cnt,
            "quantity": item_quantity[title],
        }
        for title, cnt in item_orders.most_common()
    ]
    store_items_by_quantity_rows = [
        {
            "store_name": store,
            "item_title": title,
            "quantity": qty,
        }
        for (store, title), qty in store_item_quantity.most_common()
    ]

    return items_by_quantity_rows, items_by_orders_rows, store_items_by_quantity_rows


def write_detail_item_ranking_csv(items_rows: list[dict[str, Any]], out_path: Path) -> None:
    fieldnames = ["item_title", "orders", "quantity"]
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(items_rows)


def write_detail_store_item_ranking_csv(rows: list[dict[str, Any]], out_path: Path) -> None:
    fieldnames = ["store_name", "item_title", "quantity"]
    with out_path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

def parse_window_days(raw: str) -> list[int]:
    days = []
    for token in raw.split(","):
        t = token.strip()
        if not t:
            continue
        if not t.isdigit():
            continue
        value = int(t)
        if value > 0:
            days.append(value)
    uniq = sorted(set(days))
    return uniq or DEFAULT_WINDOWS_DAYS


def sort_weekday_map(mapping: dict[str, dict[str, int]]) -> dict[str, dict[str, int]]:
    return dict(sorted(mapping.items(), key=lambda kv: WEEKDAY_ORDER.get(kv[0], 99)))


def sort_hour_map(mapping: dict[str, dict[str, int]]) -> dict[str, dict[str, int]]:
    def _key(k: str) -> int:
        return int(k) if k.isdigit() else 99

    return dict(sorted(mapping.items(), key=lambda kv: _key(kv[0])))


def summarize_rows(rows: list[dict[str, Any]], top_n: int) -> dict[str, Any]:
    totals = [int(r["total_yen"]) for r in rows]
    total_orders = len(totals)
    total_spend = sum(totals)
    avg_spend = round(total_spend / total_orders, 2) if total_orders else 0
    median_spend = statistics.median(totals) if totals else 0

    by_month = defaultdict(lambda: {"orders": 0, "spend_yen": 0})
    by_weekday = defaultdict(lambda: {"orders": 0, "spend_yen": 0})
    by_hour = defaultdict(lambda: {"orders": 0, "spend_yen": 0})
    store_orders = Counter()
    store_spend = Counter()

    for r in rows:
        amount = int(r["total_yen"])
        dt = r.get("mail_dt")
        month = dt.strftime("%Y-%m") if isinstance(dt, datetime) else str(r.get("year_month", ""))
        weekday = dt.strftime("%a") if isinstance(dt, datetime) else str(r.get("weekday", ""))
        hour = dt.strftime("%H") if isinstance(dt, datetime) else str(r.get("hour", ""))
        store = str(r.get("store_name", ""))

        if month:
            by_month[month]["orders"] += 1
            by_month[month]["spend_yen"] += amount
        if weekday:
            by_weekday[weekday]["orders"] += 1
            by_weekday[weekday]["spend_yen"] += amount
        if hour:
            by_hour[hour]["orders"] += 1
            by_hour[hour]["spend_yen"] += amount
        if store and store != "(unknown)":
            store_orders[store] += 1
            store_spend[store] += amount

    return {
        "totals": {
            "orders": total_orders,
            "spend_yen": total_spend,
            "average_yen": avg_spend,
            "median_yen": median_spend,
        },
        "by_month": dict(sorted(by_month.items())),
        "by_weekday": sort_weekday_map(dict(by_weekday)),
        "by_hour": sort_hour_map(dict(by_hour)),
        "top_stores_by_orders": [
            {"store_name": name, "orders": count} for name, count in store_orders.most_common(top_n)
        ],
        "top_stores_by_spend": [
            {"store_name": name, "spend_yen": amount} for name, amount in store_spend.most_common(top_n)
        ],
    }


def pct_change(current: float, previous: float) -> float | None:
    if previous == 0:
        return None
    return round(((current - previous) / previous) * 100, 2)


def summarize_window(
    rows: list[dict[str, Any]], window_days: int, anchor_dt: datetime, top_n: int
) -> dict[str, Any]:
    start_dt = anchor_dt - timedelta(days=window_days)
    prev_start = start_dt - timedelta(days=window_days)
    prev_end = start_dt

    def in_range(dt: datetime | None, lo: datetime, hi: datetime, hi_inclusive: bool) -> bool:
        if dt is None:
            return False
        if hi_inclusive:
            return lo <= dt <= hi
        return lo <= dt < hi

    current_rows = [r for r in rows if in_range(r.get("mail_dt"), start_dt, anchor_dt, True)]
    previous_rows = [r for r in rows if in_range(r.get("mail_dt"), prev_start, prev_end, False)]

    current = summarize_rows(current_rows, top_n=top_n)
    previous = summarize_rows(previous_rows, top_n=top_n)

    by_day = defaultdict(lambda: {"orders": 0, "spend_yen": 0})
    for r in current_rows:
        dt = r.get("mail_dt")
        if not isinstance(dt, datetime):
            continue
        day = dt.strftime("%Y-%m-%d")
        by_day[day]["orders"] += 1
        by_day[day]["spend_yen"] += int(r["total_yen"])

    current_totals = current["totals"]
    previous_totals = previous["totals"]
    compare = {
        "orders_diff": current_totals["orders"] - previous_totals["orders"],
        "spend_yen_diff": current_totals["spend_yen"] - previous_totals["spend_yen"],
        "average_yen_diff": round(current_totals["average_yen"] - previous_totals["average_yen"], 2),
        "orders_pct_change": pct_change(current_totals["orders"], previous_totals["orders"]),
        "spend_yen_pct_change": pct_change(current_totals["spend_yen"], previous_totals["spend_yen"]),
        "average_yen_pct_change": pct_change(current_totals["average_yen"], previous_totals["average_yen"]),
    }

    return {
        "days": window_days,
        "start_inclusive": start_dt.strftime("%Y-%m-%d %H:%M"),
        "end_inclusive": anchor_dt.strftime("%Y-%m-%d %H:%M"),
        "totals": current_totals,
        "compare_previous_same_length_window": compare,
        "by_weekday": current["by_weekday"],
        "by_hour": current["by_hour"],
        "by_day": dict(sorted(by_day.items())),
        "top_stores_by_orders": current["top_stores_by_orders"],
        "top_stores_by_spend": current["top_stores_by_spend"],
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Analyze Uber Eats order mails exported by gog.")
    parser.add_argument(
        "--workdir",
        default=str(DEFAULT_WORKDIR),
        help="Directory containing raw_by_year/*.json and where outputs are written.",
    )
    parser.add_argument(
        "--detail-dir",
        default=str(DEFAULT_DETAIL_DIR),
        help="Directory containing ubereats.com scraped files (uber_eats_*.json).",
    )
    parser.add_argument(
        "--detail-mode",
        choices=["auto", "on", "off"],
        default="auto",
        help="auto: use detail dir only when files exist, on: expect and use, off: ignore detail dir.",
    )
    parser.add_argument(
        "--windows",
        default="7,30",
        help="Comma-separated analysis windows in days. Example: 7,30,90",
    )
    parser.add_argument(
        "--top-stores",
        type=int,
        default=20,
        help="Number of stores to include in top store rankings.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    workdir = Path(args.workdir).expanduser().resolve()
    detail_dir = Path(args.detail_dir).expanduser().resolve()
    raw_dir = workdir / "raw_by_year"
    out_csv = workdir / "uber_orders_all.csv"
    out_summary = workdir / "uber_orders_summary_all.json"
    out_detail_orders = workdir / "uber_detail_orders.csv"
    out_detail_items_ranking = workdir / "uber_detail_items_ranking.csv"
    out_detail_store_items_ranking = workdir / "uber_detail_store_items_ranking.csv"

    window_days = parse_window_days(args.windows)
    top_stores = max(1, args.top_stores)
    workdir.mkdir(parents=True, exist_ok=True)

    json_files = sorted(raw_dir.glob("uber_*.json"))
    if not json_files:
        raise SystemExit(f"No input files found: {raw_dir}/uber_*.json")

    rows: list[dict[str, Any]] = []
    seen_ids: set[str] = set()

    for path in json_files:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
        for msg in data.get("messages", []):
            msg_id = msg.get("id", "")
            if not msg_id or msg_id in seen_ids:
                continue
            seen_ids.add(msg_id)

            subject = msg.get("subject", "")
            text = html_to_text(msg.get("body", ""))
            total_yen = extract_total_yen(text)
            if not looks_like_order(subject, text, total_yen):
                continue

            dt = parse_mail_datetime(msg.get("date", ""))
            store_name = extract_store_name(text) or "(unknown)"
            labels = "|".join(msg.get("labels", []))
            rows.append(
                {
                    "message_id": msg_id,
                    "thread_id": msg.get("threadId", ""),
                    "mail_date": msg.get("date", ""),
                    "mail_dt": dt,
                    "year_month": dt.strftime("%Y-%m") if dt else "",
                    "weekday": dt.strftime("%a") if dt else "",
                    "hour": dt.strftime("%H") if dt else "",
                    "subject": subject,
                    "store_name": store_name,
                    "total_yen": int(total_yen) if total_yen is not None else 0,
                    "labels": labels,
                }
            )

    rows.sort(
        key=lambda r: r["mail_dt"] if isinstance(r.get("mail_dt"), datetime) else datetime.min,
        reverse=True,
    )

    fieldnames = [
        "message_id",
        "thread_id",
        "mail_date",
        "year_month",
        "weekday",
        "hour",
        "subject",
        "store_name",
        "total_yen",
        "labels",
    ]
    with out_csv.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows([{k: r[k] for k in fieldnames} for r in rows])

    overall = summarize_rows(rows, top_n=top_stores)
    mail_dts = [r["mail_dt"] for r in rows if isinstance(r.get("mail_dt"), datetime)]
    now_dt = datetime.now().replace(second=0, microsecond=0)
    latest_mail_dt = max(mail_dts) if mail_dts else None
    earliest_mail_dt = min(mail_dts) if mail_dts else None

    windows = {}
    for day in window_days:
        key = f"last_{day}d"
        windows[key] = summarize_window(rows, window_days=day, anchor_dt=now_dt, top_n=top_stores)

    detail_section: dict[str, Any] = {
        "mode": args.detail_mode,
        "detail_dir": str(detail_dir),
        "used": False,
        "supplemental_to": "main",
        "outputs": {
            "detail_orders_csv": str(out_detail_orders),
            "detail_items_ranking_csv": str(out_detail_items_ranking),
            "detail_store_items_ranking_csv": str(out_detail_store_items_ranking),
        },
    }
    detail_brief: dict[str, Any] | None = None
    detail_files = sorted(detail_dir.glob("uber_eats_*.json")) if args.detail_mode != "off" else []

    if args.detail_mode == "on" and not detail_files:
        detail_section["reason"] = f"detail_mode=on but no files found: {detail_dir}/uber_eats_*.json"
    elif detail_files:
        detail_rows, detail_source_files = load_detail_rows(detail_dir)
        if detail_rows:
            write_detail_orders_csv(detail_rows, out_detail_orders)
            items_by_quantity_rows, items_by_orders_rows, store_items_by_quantity_rows = build_detail_item_rankings(
                detail_rows
            )
            write_detail_item_ranking_csv(items_by_quantity_rows, out_detail_items_ranking)
            write_detail_store_item_ranking_csv(store_items_by_quantity_rows, out_detail_store_items_ranking)

            detail_overall = summarize_rows(detail_rows, top_n=top_stores)
            detail_windows = {}
            for day in window_days:
                key = f"last_{day}d"
                detail_windows[key] = summarize_window(
                    detail_rows, window_days=day, anchor_dt=now_dt, top_n=top_stores
                )

            detail_dts = [r["mail_dt"] for r in detail_rows if isinstance(r.get("mail_dt"), datetime)]
            detail_latest_dt = max(detail_dts) if detail_dts else None
            detail_earliest_dt = min(detail_dts) if detail_dts else None

            main_orders = overall["totals"]["orders"]
            detail_orders = detail_overall["totals"]["orders"]
            coverage_ratio = round(detail_orders / main_orders, 4) if main_orders else None

            detail_section.update(
                {
                    "used": True,
                    "source_files": detail_source_files,
                    "period": {
                        "min_order_date": (
                            detail_earliest_dt.strftime("%Y-%m-%d %H:%M") if detail_earliest_dt else None
                        ),
                        "max_order_date": detail_latest_dt.strftime("%Y-%m-%d %H:%M") if detail_latest_dt else None,
                    },
                    "totals": detail_overall["totals"],
                    "coverage_vs_main": {
                        "orders_ratio": coverage_ratio,
                        "orders_ratio_pct": round(coverage_ratio * 100, 2) if coverage_ratio is not None else None,
                    },
                    "by_month": detail_overall["by_month"],
                    "by_weekday": detail_overall["by_weekday"],
                    "by_hour": detail_overall["by_hour"],
                    "analysis_windows": detail_windows,
                    "top_stores_by_orders": detail_overall["top_stores_by_orders"],
                    "top_stores_by_spend": detail_overall["top_stores_by_spend"],
                    "top_items_by_quantity": items_by_quantity_rows[:top_stores],
                    "top_items_by_orders": items_by_orders_rows[:top_stores],
                    "top_store_items_by_quantity": store_items_by_quantity_rows[:top_stores],
                }
            )
            detail_brief = {
                "used": True,
                "orders": detail_overall["totals"]["orders"],
                "spend_yen": detail_overall["totals"]["spend_yen"],
                "coverage_orders_pct": detail_section["coverage_vs_main"]["orders_ratio_pct"],
            }
        else:
            detail_section["reason"] = "detail files found but no completed orders parsed"
    elif args.detail_mode != "off":
        detail_section["reason"] = f"detail files not found: {detail_dir}/uber_eats_*.json"
    else:
        detail_section["reason"] = "detail disabled by --detail-mode off"

    summary = {
        "source_files": [str(p) for p in json_files],
        "generated_at": now_dt.isoformat(timespec="minutes"),
        "analysis_anchor": now_dt.strftime("%Y-%m-%d %H:%M"),
        "analysis_windows_days": window_days,
        "data_source_policy": {
            "main_dataset": str(workdir),
            "main_role": "comprehensive",
            "supplemental_dataset": str(detail_dir),
            "supplemental_role": "detailed",
            "rule": "Use main dataset for canonical totals/windows; use supplemental dataset for item-level detail.",
        },
        "data_latest_mail_date": latest_mail_dt.strftime("%Y-%m-%d %H:%M") if latest_mail_dt else None,
        "period": {
            "min_mail_date": earliest_mail_dt.strftime("%Y-%m-%d %H:%M") if earliest_mail_dt else None,
            "max_mail_date": latest_mail_dt.strftime("%Y-%m-%d %H:%M") if latest_mail_dt else None,
        },
        "totals": overall["totals"],
        "by_month": overall["by_month"],
        "by_weekday": overall["by_weekday"],
        "by_hour": overall["by_hour"],
        "top_stores_by_orders": overall["top_stores_by_orders"],
        "top_stores_by_spend": overall["top_stores_by_spend"],
        "analysis_windows": windows,
        "supplemental_detail": detail_section,
    }

    with out_summary.open("w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    window_brief = {}
    for key, value in windows.items():
        window_brief[key] = value["totals"]

    print(
        json.dumps(
            {
                "orders": overall["totals"]["orders"],
                "spend_yen": overall["totals"]["spend_yen"],
                "average_yen": overall["totals"]["average_yen"],
                "analysis_anchor": summary["analysis_anchor"],
                "windows": window_brief,
                "supplemental_detail": detail_brief or {"used": False},
                "csv": str(out_csv),
                "summary": str(out_summary),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
