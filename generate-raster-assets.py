from PIL import Image, ImageDraw, ImageFont
import os

public_dir = os.path.join(os.path.dirname(__file__), 'public')

# 1. Generate master og-image.png (1200 x 630)
def generate_og_image():
    width, height = 1200, 630
    img = Image.new('RGBA', (width, height), color=(12, 13, 20, 255))
    draw = ImageDraw.Draw(img)

    # Ambient radial gradient simulation
    for r in range(400, 0, -5):
        alpha = int(35 * (1 - r / 400))
        draw.ellipse([width - 300 - r, 180 - r, width - 300 + r, 180 + r], fill=(6, 182, 212, alpha))
    for r in range(350, 0, -5):
        alpha = int(25 * (1 - r / 350))
        draw.ellipse([width - 450 - r, 250 - r, width - 450 + r, 250 + r], fill=(168, 85, 247, alpha))

    # Outer border
    draw.rounded_rectangle([24, 24, width - 24, height - 24], radius=32, outline=(39, 39, 42, 180), width=2)
    draw.rounded_rectangle([28, 28, width - 28, height - 28], radius=28, outline=(6, 182, 212, 60), width=1)

    # Top pill
    draw.rounded_rectangle([70, 70, 390, 108], radius=19, fill=(24, 24, 27, 255), outline=(39, 39, 42, 255), width=1)
    draw.ellipse([88, 84, 98, 94], fill=(6, 182, 212, 255))
    draw.text((108, 81), 'TIKHD MEDIA ENGINEERING LABS', fill=(161, 161, 170, 255))

    # Category Pill
    draw.rounded_rectangle([410, 70, 620, 108], radius=19, fill=(8, 51, 68, 255), outline=(14, 116, 144, 255), width=2)
    draw.text((435, 80), 'UNIVERSAL MEDIA ENGINE', fill=(6, 182, 212, 255))

    # Title
    draw.text((70, 200), 'TIKHD - Universal Video & Audio Downloader', fill=(255, 255, 255, 255))
    draw.text((70, 250), '1080p Full HD Video  •  160kbps MP3 Audio  •  Zero Watermarks', fill=(6, 182, 212, 255))
    draw.text((70, 310), 'The high-speed edge downloader for TikTok, YouTube, Instagram Reels,', fill=(212, 212, 216, 255))
    draw.text((70, 345), 'Facebook, Audiomack, X, and over 1,000+ streaming platforms.', fill=(161, 161, 170, 255))

    # Platform pills bar
    platforms = ['TikTok / Douyin', 'YouTube (1080p/4K)', 'Instagram Reels', 'Audiomack (160k MP3)', 'Facebook', 'X / Twitter']
    px = 70
    for p in platforms:
        w = len(p) * 8 + 24
        draw.rounded_rectangle([px, 400, px + w, 432], radius=16, fill=(24, 24, 27, 255), outline=(39, 39, 42, 255), width=1)
        draw.text((px + 12, 408), p, fill=(228, 228, 231, 255))
        px += w + 12

    # Divider
    draw.line([70, 480, 1130, 480], fill=(39, 39, 42, 255), width=1)
    draw.line([70, 480, 320, 480], fill=(6, 182, 212, 255), width=3)

    # Footer
    draw.text((70, 520), 'FREE & OPEN ACCESS  •  100% SECURE  •  NO INSTALLATION REQUIRED', fill=(113, 113, 122, 255))
    draw.rounded_rectangle([920, 505, 1110, 545], radius=12, fill=(24, 24, 27, 255), outline=(6, 182, 212, 100), width=1)
    draw.text((950, 517), 'TIKHD.APP', fill=(255, 255, 255, 255))

    og_path = os.path.join(public_dir, 'og-image.png')
    img.save(og_path, 'PNG', optimize=True)
    print(f'[SUCCESS] Generated {og_path}')

# 2. Generate Favicons & App Icons (512, 180, 96, 48, ICO)
def generate_favicons():
    size = 512
    icon = Image.new('RGBA', (size, size), color=(0, 0, 0, 0))
    draw = ImageDraw.Draw(icon)

    # Squircle with dark background
    draw.rounded_rectangle([8, 8, size - 8, size - 8], radius=112, fill=(13, 14, 21, 255), outline=(6, 182, 212, 200), width=8)

    # Glow ring
    draw.ellipse([80, 80, size - 80, size - 80], fill=(6, 182, 212, 40), outline=(6, 182, 212, 255), width=12)
    draw.ellipse([110, 110, size - 110, size - 110], fill=(18, 20, 30, 255))

    # Centered Download Arrow Icon (TIKHD signature glyph)
    # Shaft
    draw.rounded_rectangle([236, 160, 276, 290], radius=8, fill=(6, 182, 212, 255))
    # Arrow head
    draw.polygon([(180, 270), (256, 350), (332, 270)], fill=(6, 182, 212, 255))
    # Tray bar
    draw.rounded_rectangle([170, 370, 342, 396], radius=8, fill=(168, 85, 247, 255))

    # Save apple-touch-icon.png (180x180)
    apple_icon = icon.resize((180, 180), Image.Resampling.LANCZOS)
    apple_path = os.path.join(public_dir, 'apple-touch-icon.png')
    apple_icon.save(apple_path, 'PNG', optimize=True)
    print(f'[SUCCESS] Generated {apple_path}')

    # Save favicon-96x96.png
    fav96 = icon.resize((96, 96), Image.Resampling.LANCZOS)
    fav96_path = os.path.join(public_dir, 'favicon-96x96.png')
    fav96.save(fav96_path, 'PNG', optimize=True)
    print(f'[SUCCESS] Generated {fav96_path}')

    # Save favicon-48x48.png
    fav48 = icon.resize((48, 48), Image.Resampling.LANCZOS)
    fav48_path = os.path.join(public_dir, 'favicon-48x48.png')
    fav48.save(fav48_path, 'PNG', optimize=True)
    print(f'[SUCCESS] Generated {fav48_path}')

    # Save favicon.ico (multi-frame)
    fav16 = icon.resize((16, 16), Image.Resampling.LANCZOS)
    fav32 = icon.resize((32, 32), Image.Resampling.LANCZOS)
    ico_path = os.path.join(public_dir, 'favicon.ico')
    icon.save(ico_path, format='ICO', sizes=[(16, 16), (32, 32), (48, 48)])
    print(f'[SUCCESS] Generated {ico_path}')

generate_og_image()
generate_favicons()
