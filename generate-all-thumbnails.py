import os
import json
import math
from PIL import Image, ImageDraw, ImageFont

public_dir = os.path.join(os.path.dirname(__file__), 'public')
thumbs_dir = os.path.join(public_dir, 'thumbnails')
os.makedirs(thumbs_dir, exist_ok=True)

blog_meta_path = os.path.join(os.path.dirname(__file__), 'src', 'blog-meta.json')
with open(blog_meta_path, 'r', encoding='utf-8') as f:
    blogs = json.load(f)

print(f"Loaded {len(blogs)} blog articles to generate thumbnails for.")

# Cluster theme palettes (RGB values)
THEMES = {
    'Competitor Reviews': {
        'primary': (6, 182, 212),     # cyan-500
        'secondary': (59, 130, 246),  # blue-500
        'bg_glow': (6, 182, 212),
        'pill_bg': (8, 51, 68),
        'pill_border': (14, 116, 144),
        'icon': 'comparison'
    },
    'Technology & Architecture': {
        'primary': (16, 185, 129),   # emerald-500
        'secondary': (6, 182, 212),   # cyan-500
        'bg_glow': (16, 185, 129),
        'pill_bg': (6, 78, 59),
        'pill_border': (4, 120, 87),
        'icon': 'code'
    },
    'Creator Workflows': {
        'primary': (244, 63, 94),    # rose-500
        'secondary': (168, 85, 247), # purple-500
        'bg_glow': (244, 63, 94),
        'pill_bg': (76, 5, 25),
        'pill_border': (190, 18, 60),
        'icon': 'creator'
    },
    'Platform Deep Dives': {
        'primary': (168, 85, 247),   # purple-500
        'secondary': (6, 182, 212),   # cyan-500
        'bg_glow': (168, 85, 247),
        'pill_bg': (59, 7, 100),
        'pill_border': (126, 34, 206),
        'icon': 'platform'
    },
    'Audio Engineering': {
        'primary': (245, 158, 11),   # amber-500
        'secondary': (239, 68, 68),   # red-500
        'bg_glow': (245, 158, 11),
        'pill_bg': (69, 26, 3),
        'pill_border': (180, 83, 9),
        'icon': 'audio'
    },
    'Security & Legal': {
        'primary': (59, 130, 246),   # blue-500
        'secondary': (16, 185, 129),  # emerald-500
        'bg_glow': (59, 130, 246),
        'pill_bg': (23, 37, 84),
        'pill_border': (29, 78, 216),
        'icon': 'security'
    }
}

# Load standard system fonts with fallback
def get_fonts():
    try:
        # Windows standard system fonts
        font_bold = ImageFont.truetype("arialbd.ttf", 36)
        font_title_large = ImageFont.truetype("arialbd.ttf", 40)
        font_pill = ImageFont.truetype("arialbd.ttf", 14)
        font_meta = ImageFont.truetype("arialbd.ttf", 13)
        font_brand = ImageFont.truetype("arialbd.ttf", 16)
    except Exception:
        font_bold = ImageFont.load_default()
        font_title_large = font_bold
        font_pill = font_bold
        font_meta = font_bold
        font_brand = font_bold
    return font_title_large, font_pill, font_meta, font_brand

font_title, font_pill, font_meta, font_brand = get_fonts()

def wrap_title(title, max_chars=40):
    words = title.split()
    lines = []
    curr = []
    for w in words:
        if len(" ".join(curr + [w])) <= max_chars:
            curr.append(w)
        else:
            if curr:
                lines.append(" ".join(curr))
            curr = [w]
            if len(lines) == 2:
                break
    if curr and len(lines) < 2:
        lines.append(" ".join(curr))
    if len(lines) == 2 and words.index(curr[-1]) < len(words) - 1:
        if not lines[1].endswith("..."):
            lines[1] += "..."
    return lines

def draw_icon(draw, icon_type, center_x, center_y, primary, secondary):
    cx, cy = center_x, center_y
    # Glow circle
    for r in range(80, 0, -5):
        alpha = int(25 * (1 - r / 80))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(primary[0], primary[1], primary[2], alpha))
    draw.ellipse([cx - 65, cy - 65, cx + 65, cy + 65], fill=(24, 24, 27, 240), outline=primary, width=3)

    if icon_type == 'comparison':
        # Comparison arrows / vs meter
        draw.line([cx - 28, cy - 28, cx + 28, cy + 28], fill=primary, width=5)
        draw.polygon([(cx + 28, cy + 28), (cx + 12, cy + 28), (cx + 28, cy + 12)], fill=primary)
        draw.line([cx + 28, cy - 28, cx - 28, cy + 28], fill=secondary, width=5)
        draw.polygon([(cx - 28, cy + 28), (cx - 12, cy + 28), (cx - 28, cy + 12)], fill=secondary)
        draw.ellipse([cx - 10, cy - 10, cx + 10, cy + 10], fill=(12, 13, 20, 255), outline=primary, width=2)

    elif icon_type == 'code':
        # Terminal prompt
        draw.rounded_rectangle([cx - 40, cy - 30, cx + 40, cy + 30], radius=8, fill=(15, 23, 42, 255), outline=primary, width=2)
        draw.line([cx - 25, cy - 10, cx - 12, cy], fill=primary, width=4)
        draw.line([cx - 12, cy, cx - 25, cy + 10], fill=primary, width=4)
        draw.line([cx - 4, cy + 10, cx + 18, cy + 10], fill=secondary, width=4)

    elif icon_type == 'creator':
        # Camera aperture & star
        draw.ellipse([cx - 36, cy - 36, cx + 36, cy + 36], outline=secondary, width=3)
        draw.ellipse([cx - 18, cy - 18, cx + 18, cy + 18], fill=primary)
        # Sparkles
        draw.line([cx, cy - 50, cx, cy - 40], fill=primary, width=3)
        draw.line([cx + 50, cy, cx + 40, cy], fill=primary, width=3)

    elif icon_type == 'platform':
        # Multi-platform play triangle & note
        draw.polygon([(cx - 18, cy - 28), (cx - 18, cy + 28), (cx + 25, cy)], fill=primary)
        draw.ellipse([cx + 15, cy - 25, cx + 35, cy - 5], fill=secondary)

    elif icon_type == 'audio':
        # Equalizer bars
        bars = [15, 35, 55, 30, 18]
        bar_w = 8
        start_x = cx - 26
        for i, h in enumerate(bars):
            bx = start_x + i * 12
            color = primary if i % 2 == 0 else secondary
            draw.rounded_rectangle([bx, cy - h//2, bx + bar_w, cy + h//2], radius=4, fill=color)

    elif icon_type == 'security':
        # Shield with checkmark
        shield_pts = [
            (cx, cy - 32),
            (cx + 30, cy - 18),
            (cx + 30, cy + 8),
            (cx, cy + 35),
            (cx - 30, cy + 8),
            (cx - 30, cy - 18)
        ]
        draw.polygon(shield_pts, fill=(15, 23, 42, 255), outline=primary)
        # Checkmark
        draw.line([cx - 12, cy + 2, cx - 2, cy + 12], fill=primary, width=4)
        draw.line([cx - 2, cy + 12, cx + 15, cy - 10], fill=primary, width=4)

def generate_thumbnail(post):
    width, height = 1200, 630
    cat = post.get('category', 'Competitor Reviews')
    theme = THEMES.get(cat, THEMES['Competitor Reviews'])
    primary = theme['primary']
    secondary = theme['secondary']

    img = Image.new('RGBA', (width, height), color=(12, 13, 20, 255))
    draw = ImageDraw.Draw(img)

    # Ambient radial gradients
    glow_color = theme['bg_glow']
    for r in range(450, 0, -6):
        alpha = int(32 * (1 - r / 450))
        draw.ellipse([width - 250 - r, 200 - r, width - 250 + r, 200 + r], fill=(glow_color[0], glow_color[1], glow_color[2], alpha))
    for r in range(350, 0, -6):
        alpha = int(20 * (1 - r / 350))
        draw.ellipse([150 - r, height - 150 - r, 150 + r, height - 150 + r], fill=(secondary[0], secondary[1], secondary[2], alpha))

    # Subtle cyber grid pattern
    for x in range(0, width, 50):
        draw.line([x, 0, x, height], fill=(39, 39, 42, 40), width=1)
    for y in range(0, height, 50):
        draw.line([0, y, width, y], fill=(39, 39, 42, 40), width=1)

    # Outer luxury double border
    draw.rounded_rectangle([24, 24, width - 24, height - 24], radius=32, outline=(39, 39, 42, 160), width=2)
    draw.rounded_rectangle([28, 28, width - 28, height - 28], radius=28, outline=(primary[0], primary[1], primary[2], 60), width=1)

    # Top-left engineering pill
    draw.rounded_rectangle([70, 60, 390, 102], radius=21, fill=(24, 24, 27, 255), outline=(39, 39, 42, 255), width=1)
    draw.ellipse([88, 76, 98, 86], fill=primary)
    draw.text((110, 71), "TIKHD MEDIA ENGINEERING LABS", fill=(161, 161, 170, 255), font=font_pill)

    # Top-right category pill
    cat_text = cat.upper()
    cat_w = len(cat_text) * 10 + 44
    draw.rounded_rectangle([width - 70 - cat_w, 60, width - 70, 102], radius=21, fill=theme['pill_bg'], outline=theme['pill_border'], width=2)
    draw.text((width - 70 - cat_w + 22, 71), cat_text, fill=primary, font=font_pill)

    # Right-side thematic illustration icon
    draw_icon(draw, theme['icon'], width - 220, 310, primary, secondary)

    # Title area
    title_lines = wrap_title(post.get('title', ''))
    ty = 230
    for i, line in enumerate(title_lines):
        color = (255, 255, 255, 255) if i == 0 else (228, 228, 231, 255)
        # Subtle drop shadow
        draw.text((72, ty + 2), line, fill=(0, 0, 0, 180), font=font_title)
        draw.text((70, ty), line, fill=color, font=font_title)
        ty += 58

    # Excerpt snippet subtitle
    excerpt = post.get('excerpt', '')
    if excerpt:
        words = excerpt.split()
        sub1 = " ".join(words[:11])
        if len(words) > 11:
            sub1 += "..."
        draw.text((70, ty + 10), sub1, fill=(161, 161, 170, 255), font=font_meta)

    # Divider bar
    draw.line([70, 500, width - 70, 500], fill=(39, 39, 42, 255), width=1)
    draw.line([70, 500, 360, 500], fill=primary, width=3)

    # Footer metadata
    footer_meta = f"OCTOBER 2026   •   {post.get('readTime', '16 MIN').upper()}   •   WATERMARK-FREE"
    draw.text((70, 535), footer_meta, fill=(113, 113, 122, 255), font=font_meta)

    # Bottom-right TIKHD brand pill
    draw.rounded_rectangle([width - 240, 520, width - 70, 560], radius=12, fill=(24, 24, 27, 255), outline=(primary[0], primary[1], primary[2], 120), width=1)
    # Download glyph
    draw.line([width - 220, 535, width - 220, 547], fill=primary, width=2)
    draw.polygon([(width - 225, 545), (width - 220, 550), (width - 215, 545)], fill=primary)
    draw.line([width - 226, 552, width - 214, 552], fill=primary, width=2)
    draw.text((width - 200, 531), "TIKHD.APP", fill=(255, 255, 255, 255), font=font_brand)

    # Save both WebP and PNG
    slug = post['slug']
    webp_path = os.path.join(thumbs_dir, f"{slug}.webp")
    png_path = os.path.join(thumbs_dir, f"{slug}.png")

    # RGB mode for WebP/PNG
    rgb_img = img.convert('RGB')
    rgb_img.save(webp_path, 'WEBP', quality=90, method=6)
    rgb_img.save(png_path, 'PNG', optimize=True)

# Generate for all 132 blogs
count = 0
for p in blogs:
    generate_thumbnail(p)
    count += 1
    if count % 20 == 0 or count == len(blogs):
        print(f"Generated {count}/{len(blogs)} thumbnails...")

# Also generate default.webp and default.png
default_post = {
    'title': 'Universal Video & Audio Downloader Guide',
    'slug': 'default',
    'category': 'Competitor Reviews',
    'readTime': '15 MIN',
    'excerpt': 'Complete technical guides and authority breakdowns for watermark-free video and high-fidelity audio.'
}
generate_thumbnail(default_post)

print(f"[SUCCESS] Complete! Generated {count} WebP and PNG thumbnails in {thumbs_dir}")
