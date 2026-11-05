import os
import math
from PIL import Image, ImageDraw, ImageFilter

def create_yoruichi_icon(size=512):
    # Create base canvas with RGBA
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Rounded squircle background
    radius = int(size * 0.22)
    bg_box = [0, 0, size, size]
    
    # Background gradient
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    
    # Draw radial/conical style gradient layers for cosmic violet to deep obsidian
    center_x, center_y = size / 2, size / 2
    max_dist = size * 0.75
    for r in range(int(max_dist), 0, -2):
        t = r / max_dist
        # Inner: deep purple-indigo (#3b185f), Outer: deep obsidian (#0c0915)
        red = int(59 * (1 - t) + 12 * t)
        green = int(24 * (1 - t) + 9 * t)
        blue = int(95 * (1 - t) + 21 * t)
        bg_draw.ellipse([center_x - r, center_y - r, center_x + r, center_y + r], fill=(red, green, blue, 255))
    
    # Clip to squircle mask
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle(bg_box, radius=radius, fill=255)
    
    final_bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    final_bg.paste(bg, (0, 0), mask=mask)
    
    # Outer glowing ring (Flash Goddess Golden Ring)
    ring_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ring_draw = ImageDraw.Draw(ring_layer)
    ring_margin = size * 0.16
    ring_box = [ring_margin, ring_margin, size - ring_margin, size - ring_margin]
    ring_draw.ellipse(ring_box, outline=(245, 158, 11, 200), width=int(size * 0.024))
    
    # Inner energy arcs
    inner_margin = size * 0.22
    ring_draw.arc([inner_margin, inner_margin, size - inner_margin, size - inner_margin], start=30, end=150, fill=(217, 119, 6, 230), width=int(size * 0.015))
    ring_draw.arc([inner_margin, inner_margin, size - inner_margin, size - inner_margin], start=210, end=330, fill=(168, 85, 247, 230), width=int(size * 0.015))

    # Glow effect on ring
    ring_glow = ring_layer.filter(ImageFilter.GaussianBlur(radius=size * 0.03))
    
    # Sharp stylized "Y" monogram with ninja blade/flash angles
    y_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    y_draw = ImageDraw.Draw(y_layer)
    
    s = size / 512.0
    # Left branch of Y
    left_branch = [
        (140 * s, 145 * s),
        (185 * s, 145 * s),
        (256 * s, 260 * s),
        (256 * s, 290 * s),
        (220 * s, 260 * s),
        (140 * s, 145 * s)
    ]
    # Right branch of Y
    right_branch = [
        (372 * s, 145 * s),
        (327 * s, 145 * s),
        (256 * s, 260 * s),
        (256 * s, 290 * s),
        (292 * s, 260 * s),
        (372 * s, 145 * s)
    ]
    # Stem of Y
    stem = [
        (238 * s, 265 * s),
        (274 * s, 265 * s),
        (274 * s, 375 * s),
        (256 * s, 395 * s),
        (238 * s, 375 * s)
    ]
    
    # Golden Flash highlight accent polygon
    flash_accent = [
        (256 * s, 160 * s),
        (270 * s, 225 * s),
        (256 * s, 245 * s),
        (242 * s, 225 * s)
    ]

    # Draw Y shapes
    y_draw.polygon(left_branch, fill=(255, 255, 255, 250))
    y_draw.polygon(right_branch, fill=(243, 244, 246, 250))
    y_draw.polygon(stem, fill=(249, 250, 251, 250))
    y_draw.polygon(flash_accent, fill=(251, 191, 36, 255))
    
    # Two sleek horizontal slash lines (Flash Step motif)
    y_draw.line([(175 * s, 235 * s), (195 * s, 235 * s)], fill=(251, 191, 36, 220), width=int(3 * s))
    y_draw.line([(317 * s, 235 * s), (337 * s, 235 * s)], fill=(251, 191, 36, 220), width=int(3 * s))

    # Y glow
    y_glow = y_layer.filter(ImageFilter.GaussianBlur(radius=size * 0.025))

    # Composite layers
    result = Image.alpha_composite(final_bg, ring_glow)
    result = Image.alpha_composite(result, ring_layer)
    result = Image.alpha_composite(result, y_glow)
    result = Image.alpha_composite(result, y_layer)

    return result

if __name__ == "__main__":
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    icon = create_yoruichi_icon(512)
    
    build_dir = os.path.join(project_root, "build")
    drawable_dir = os.path.join(project_root, "android", "app", "src", "main", "res", "drawable")
    
    os.makedirs(build_dir, exist_ok=True)
    os.makedirs(drawable_dir, exist_ok=True)
    
    # Save standard icon
    icon.save(os.path.join(build_dir, "icon.png"), "PNG")
    icon.save(os.path.join(drawable_dir, "yoruichi_icon.png"), "PNG")
    icon.save(os.path.join(drawable_dir, "myraa_icon.png"), "PNG")

    # Mipmap densities
    densities = {
        "mipmap-mdpi": 48,
        "mipmap-hdpi": 72,
        "mipmap-xhdpi": 96,
        "mipmap-xxhdpi": 144,
        "mipmap-xxxhdpi": 192,
    }
    for folder, dim in densities.items():
        path = os.path.join(project_root, "android", "app", "src", "main", "res", folder)
        os.makedirs(path, exist_ok=True)
        resized = icon.resize((dim, dim), Image.Resampling.LANCZOS)
        resized.save(os.path.join(path, "yoruichi_icon.png"), "PNG")
        resized.save(os.path.join(path, "myraa_icon.png"), "PNG")

    print("Yoruichi icons created successfully!")
