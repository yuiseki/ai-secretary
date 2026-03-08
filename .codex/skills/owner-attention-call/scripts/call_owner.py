#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Callable


ROOT = Path(__file__).resolve().parents[4]
for relative in (
    "repos/asee/python/src",
    "repos/acaption/python/src",
    "repos/asay/python/src",
):
    candidate = str(ROOT / relative)
    if candidate not in sys.path:
        sys.path.insert(0, candidate)

from acaption.ipc_client import AcaptionIpcClient
from asee.biometric_client import RemoteBiometricStatusClient
from asay.voicevox import VoiceVoxSpeaker


def stderr_logger(message: str) -> None:
    print(message, file=sys.stderr)


def owner_visible(status: dict[str, Any] | None) -> bool:
    if not isinstance(status, dict):
        return False
    if "ownerPresent" in status:
        return bool(status.get("ownerPresent"))
    try:
        return int(status.get("ownerCount", 0)) > 0
    except Exception:
        return False


def send_ntfy_message(
    message: str,
    *,
    topic: str,
    opener: Callable[..., Any] = urllib.request.urlopen,
) -> None:
    request = urllib.request.Request(
        f"https://ntfy.sh/{urllib.parse.quote(topic)}",
        data=message.encode("utf-8"),
        method="POST",
    )
    with opener(request, timeout=10.0):
        return


def build_speaker(
    *,
    overlay_host: str,
    overlay_port: int,
    voicevox_url: str,
    speaker_id: int,
    volume_scale: float,
    speed_scale: float,
    logger: Callable[[str], None],
) -> VoiceVoxSpeaker:
    overlay = AcaptionIpcClient(
        enabled=True,
        host=overlay_host,
        port=overlay_port,
        timeout_sec=2.0,
        logger=logger,
    )
    overlay.prepare()
    speaker = VoiceVoxSpeaker(
        base_url=voicevox_url,
        speaker=speaker_id,
        volume_scale=volume_scale,
        speed_scale=speed_scale,
        sink=None,
        cache_dir=str(Path.home() / ".cache" / "yuiclaw" / "asay"),
        enabled=True,
        overlay_client=overlay,
        logger=logger,
    )
    speaker.prepare([])
    return speaker


def route_attention(
    *,
    message: str,
    status_client: Any,
    speak: Callable[[str], None],
    notify: Callable[[str], None],
    logger: Callable[[str], None],
) -> dict[str, Any]:
    status = status_client.fetch_status()
    visible = owner_visible(status)
    if visible:
        try:
            speak(message)
            return {
                "mode": "speech",
                "ownerPresent": True,
                "reason": "owner_visible",
            }
        except Exception as exc:
            logger(f"speech attention failed: {exc}")
            notify(message)
            return {
                "mode": "ntfy",
                "ownerPresent": True,
                "reason": "speech_failed",
            }

    notify(message)
    return {
        "mode": "ntfy",
        "ownerPresent": False,
        "reason": "owner_not_visible",
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Call the owner via speech when ASEE sees them, else use ntfy.",
    )
    parser.add_argument("--message", required=True)
    parser.add_argument(
        "--status-url",
        default="http://127.0.0.1:8765/biometric_status",
    )
    parser.add_argument("--overlay-host", default="127.0.0.1")
    parser.add_argument("--overlay-port", type=int, default=47832)
    parser.add_argument("--voicevox-url", default="http://127.0.0.1:50021")
    parser.add_argument("--speaker-id", type=int, default=89)
    parser.add_argument("--volume-scale", type=float, default=2.5)
    parser.add_argument("--speed-scale", type=float, default=1.25)
    parser.add_argument("--ntfy-topic", default=os.environ.get("NTFY_TOPIC", ""))
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    logger = stderr_logger

    status_client = RemoteBiometricStatusClient(
        status_url=args.status_url,
        timeout_sec=1.5,
        logger=logger,
    )
    speaker = build_speaker(
        overlay_host=args.overlay_host,
        overlay_port=args.overlay_port,
        voicevox_url=args.voicevox_url,
        speaker_id=args.speaker_id,
        volume_scale=args.volume_scale,
        speed_scale=args.speed_scale,
        logger=logger,
    )

    def _speak(text: str) -> None:
        if not speaker.enabled:
            raise RuntimeError("VOICEVOX is not ready")
        speaker.speak(text, wait=True)

    def _notify(text: str) -> None:
        if not args.ntfy_topic:
            raise RuntimeError("NTFY_TOPIC is not configured")
        send_ntfy_message(text, topic=args.ntfy_topic)

    result = route_attention(
        message=args.message,
        status_client=status_client,
        speak=_speak,
        notify=_notify,
        logger=logger,
    )
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
