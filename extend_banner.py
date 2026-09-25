"""
Utility script to convert any Gemini-generated header image (e.g., 1024x188)
into a full-width high-definition (1920x140) header banner with seamless edge expansion.
"""
import os
import sys
from PIL import Image

def process_banner(
    input_file: str = r"frontend\public\images\image copy.png",
    output_file: str = r"frontend\public\images\new_img.png",
    target_width: int = 1920,
    target_height: int = 140,
    bg_color: tuple = (255, 255, 255)
):
    if not os.path.exists(input_file):
        print(f"Error: {input_file} not found.")
        return

    img = Image.open(input_file).convert("RGB")
    orig_w, orig_h = img.size

    # Scale to target height preserving aspect ratio
    scale = target_height / orig_h
    new_w = int(orig_w * scale)
    resized_img = img.resize((new_w, target_height), Image.Resampling.LANCZOS)

    # Create 1920x140 canvas
    canvas = Image.new("RGB", (target_width, target_height), bg_color)

    # Center horizontally
    offset_x = (target_width - new_w) // 2

    # Smoothly stretch edge pixels to avoid harsh boundaries
    left_col = resized_img.crop((0, 0, 1, target_height))
    left_stretched = left_col.resize((offset_x, target_height), Image.Resampling.NEAREST)
    canvas.paste(left_stretched, (0, 0))

    right_w = target_width - (offset_x + new_w)
    if right_w > 0:
        right_col = resized_img.crop((new_w - 1, 0, new_w, target_height))
        right_stretched = right_col.resize((right_w, target_height), Image.Resampling.NEAREST)
        canvas.paste(right_stretched, (offset_x + new_w, 0))

    # Paste the crisp high-res banner in the center
    canvas.paste(resized_img, (offset_x, 0))

    # Save output
    canvas.save(output_file, quality=95)
    print(f"[SUCCESS] Banner processed successfully -> {output_file} ({target_width}x{target_height})")

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else r"frontend\public\images\image copy.png"
    dest = sys.argv[2] if len(sys.argv) > 2 else r"frontend\public\images\new_img.png"
    process_banner(src, dest)
