#!/usr/bin/env python3
"""
Generate printable QR codes for all game URLs.
Creates PNG files with labels for each dino species, food type, party event, and special items.
"""

import argparse
import os
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont


# Define all URLs to generate QR codes for
QR_DATA = {
    "dino": {
        "category": "DINO",
        "items": {
            "trex": "T-Rex",
            "spinosaurus": "Spinosaurus",
            "dilophosaurus": "Dilophosaurus",
            "pachycephalosaurus": "Pachycephalosaurus",
            "parasaurolophus": "Parasaurolophus",
            "stegosaurus": "Stegosaurus",
            "triceratops": "Triceratops",
        },
    },
    "food": {
        "category": "FOOD",
        "items": {
            "meat": "Meat",
            "mejoberries": "Mejoberries",
        },
    },
    "event": {
        "category": "EVENT",
        "items": {
            "cooking_pot": "Cooking Pot",
            "dance_floor": "Dance Floor",
            "photo_booth": "Photo Booth",
            "cake_table": "Cake Table",
            "mystery_chest": "Mystery Chest",
        },
    },
    "inspiration": {
        "category": "SPECIAL",
        "items": {
            "inspiration": "Alex's Inspiration",
        },
    },
    "note": {
        "category": "NOTE",
        "items": {
            "1": "Note #1",
            "2": "Note #2",
            "3": "Note #3",
            "4": "Note #4",
            "5": "Note #5",
        },
    },
}


def generate_qr_code_image(url: str, title: str, category: str) -> Image.Image:
    """
    Generate a QR code image with a title and category label.

    Args:
        url: The URL to encode in the QR code
        title: The title to display below the QR code
        category: The category label (e.g., "DINO", "FOOD")

    Returns:
        A PIL Image object with the QR code and labels
    """
    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="black", back_color="white")

    # Convert to RGB if needed
    if qr_img.mode != "RGB":
        qr_img = qr_img.convert("RGB")

    qr_width, qr_height = qr_img.size

    # Create a new image with space for title and category
    padding = 20
    title_height = 40
    category_height = 25
    total_height = qr_height + padding + title_height + category_height

    final_img = Image.new("RGB", (qr_width + 2 * padding, total_height), "white")

    # Paste QR code
    final_img.paste(qr_img, (padding, padding))

    # Draw title and category
    draw = ImageDraw.Draw(final_img)

    # Try to use a nice font, fallback to default if not available
    try:
        title_font = ImageFont.truetype("arial.ttf", 16)
        category_font = ImageFont.truetype("arial.ttf", 12)
    except (IOError, OSError):
        # Fallback to default font
        title_font = ImageFont.load_default()
        category_font = ImageFont.load_default()

    # Draw category
    category_y = qr_height + padding + title_height - 10
    draw.text(
        (padding, category_y),
        category,
        fill="black",
        font=category_font,
    )

    # Draw title
    title_y = qr_height + padding + 5
    draw.text(
        (padding, title_y),
        title,
        fill="black",
        font=title_font,
    )

    return final_img


def main():
    parser = argparse.ArgumentParser(
        description="Generate QR codes for all game URLs"
    )
    parser.add_argument(
        "--base-url",
        default="https://yourusername.github.io/AlexBirthdayDinos",
        help="Base URL for QR codes",
    )

    args = parser.parse_args()
    base_url = args.base_url

    # Create output directory
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)

    total_count = 0
    for type_key, type_data in QR_DATA.items():
        category = type_data["category"]
        items = type_data["items"]

        for item_key, item_label in items.items():
            # Build URL based on type
            if type_key == "inspiration":
                url = f"{base_url}/#/scan/inspiration"
            else:
                url = f"{base_url}/#/scan/{type_key}/{item_key}"

            # Generate filename
            if type_key == "inspiration":
                filename = "inspiration.png"
            else:
                filename = f"{type_key}_{item_key}.png"

            output_path = output_dir / filename

            # Generate and save QR code image
            qr_image = generate_qr_code_image(url, item_label, category)
            qr_image.save(output_path)

            total_count += 1
            print(f"Generated: {filename} ({item_label})")

    print(f"\nSuccess! Generated {total_count} QR codes in {output_dir}")


if __name__ == "__main__":
    main()
