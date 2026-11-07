from __future__ import annotations

import sys
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import call_owner  # noqa: E402


class _StatusClient:
    def __init__(self, payload):
        self.payload = payload

    def fetch_status(self):
        return self.payload


def test_owner_visible_routes_to_speech() -> None:
    spoken: list[str] = []
    notified: list[str] = []

    result = call_owner.route_attention(
        message="ユイさま、動作確認のお願いがあります",
        status_client=_StatusClient({"ownerPresent": True, "ownerCount": 2}),
        speak=lambda text: spoken.append(text),
        notify=lambda text: notified.append(text),
        logger=lambda _msg: None,
    )

    assert result["mode"] == "speech"
    assert result["ownerPresent"] is True
    assert spoken == ["ユイさま、動作確認のお願いがあります"]
    assert notified == []


def test_owner_absent_routes_to_ntfy() -> None:
    spoken: list[str] = []
    notified: list[str] = []

    result = call_owner.route_attention(
        message="ユイさま、動作確認のお願いがあります",
        status_client=_StatusClient({"ownerPresent": False, "ownerCount": 0}),
        speak=lambda text: spoken.append(text),
        notify=lambda text: notified.append(text),
        logger=lambda _msg: None,
    )

    assert result["mode"] == "ntfy"
    assert result["ownerPresent"] is False
    assert result["reason"] == "owner_not_visible"
    assert spoken == []
    assert notified == ["ユイさま、動作確認のお願いがあります"]


def test_speech_failure_falls_back_to_ntfy() -> None:
    notified: list[str] = []
    logs: list[str] = []

    def _raise(_text: str) -> None:
        raise RuntimeError("overlay down")

    result = call_owner.route_attention(
        message="ユイさま、動作確認のお願いがあります",
        status_client=_StatusClient({"ownerPresent": True}),
        speak=_raise,
        notify=lambda text: notified.append(text),
        logger=logs.append,
    )

    assert result["mode"] == "ntfy"
    assert result["ownerPresent"] is True
    assert result["reason"] == "speech_failed"
    assert notified == ["ユイさま、動作確認のお願いがあります"]
    assert any("speech attention failed" in line for line in logs)


def test_owner_visible_falls_back_to_owner_count_when_flag_missing() -> None:
    assert call_owner.owner_visible({"ownerCount": 1}) is True
    assert call_owner.owner_visible({"ownerCount": 0}) is False


def test_owner_visible_is_false_for_invalid_payload() -> None:
    assert call_owner.owner_visible(None) is False
    assert call_owner.owner_visible({"ownerPresent": ""}) is False


def test_speak_via_asay_uses_nonblocking_overlay_path() -> None:
    calls: list[tuple[str, bool]] = []

    class _Speaker:
        enabled = True

        def speak(self, text: str, *, wait: bool = False) -> None:
            calls.append((text, wait))

    call_owner.speak_via_asay(_Speaker(), "ユイさま、動作確認のお願いがあります")

    assert calls == [("ユイさま、動作確認のお願いがあります", False)]
