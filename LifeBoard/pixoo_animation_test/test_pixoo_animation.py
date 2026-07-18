"""Upload a small two-frame native animation to a Pixoo64.

This experiment is intentionally isolated from the production LifeBoard sender.
It uses Pixoo's native HttpGif sequence support, registering each frame with a
different PicOffset under the same PicID.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw
from pypixoo import Buffer, GifFrame, GifSequence, Pixoo, UploadMode


SIZE = 64
DEFAULT_SPEED_MS = 650


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Pixoo64 native animation smoke test")
    parser.add_argument("--pixoo-ip", default="", help="Pixoo64 IPv4 address")
    parser.add_argument("--speed-ms", type=int, default=DEFAULT_SPEED_MS)
    parser.add_argument(
        "--mode",
        choices=(UploadMode.COMMAND_LIST.value, UploadMode.FRAME_BY_FRAME.value),
        default=UploadMode.COMMAND_LIST.value,
    )
    parser.add_argument("--push", action="store_true", help="Upload to the real Pixoo64")
    parser.add_argument(
        "--output-dir",
        default=str(Path(__file__).resolve().parent / "preview"),
        help="Directory for frame PNG previews",
    )
    return parser.parse_args()


def build_frame(bar_on: bool) -> Image.Image:
    image = Image.new("RGB", (SIZE, SIZE), (0, 0, 0))
    draw = ImageDraw.Draw(image)

    green = (0, 255, 90) if bar_on else (0, 38, 14)
    cyan = (40, 220, 255)
    white = (235, 235, 235)

    draw.rectangle((1, 1, 4, 62), fill=green)
    draw.rectangle((8, 8, 60, 54), outline=(22, 70, 80), width=1)
    draw.text((12, 17), "PIXOO", fill=cyan)
    draw.text((12, 31), "ANIM TEST", fill=white)
    draw.rectangle((12, 45, 55, 48), fill=green)
    return image


def image_to_buffer(image: Image.Image) -> Buffer:
    rgb = image.convert("RGB")
    return Buffer.from_flat_list(list(rgb.tobytes()))


def main() -> int:
    args = parse_args()
    if args.speed_ms < 100:
        raise ValueError("--speed-ms must be at least 100")

    frames = [build_frame(True), build_frame(False)]
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    for index, image in enumerate(frames):
        image.save(output_dir / f"frame_{index}.png")

    print(f"Prepared 2 frames at {args.speed_ms} ms each: {output_dir}")
    if not args.push:
        print("Preview only. Add --push and --pixoo-ip to upload.")
        return 0
    if not args.pixoo_ip:
        raise ValueError("--pixoo-ip is required with --push")

    sequence = GifSequence(
        frames=[GifFrame(image=image_to_buffer(image), duration_ms=args.speed_ms) for image in frames],
        speed_ms=args.speed_ms,
    )
    pixoo = Pixoo(args.pixoo_ip)
    pixoo.connect()
    try:
        pic_id = pixoo.upload_sequence(sequence, mode=UploadMode(args.mode), chunk_size=2)
    finally:
        pixoo.close()

    print(f"Uploaded native 2-frame animation: PicID={pic_id}, mode={args.mode}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
