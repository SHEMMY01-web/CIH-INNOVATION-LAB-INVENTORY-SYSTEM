import os, re, glob

html_dir = "/home/olaewevictor01/INVENTORY/FRONTEND/HTML/"
files = glob.glob(os.path.join(html_dir, "*.html"))

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()

    # Remove all <tbody>...</tbody> content inside .list-table, leave the tag empty
    content = re.sub(
        r'(<table[^>]*class="[^"]*list-table[^"]*"[^>]*>.*?<tbody>)(.*?)(</tbody>)',
        lambda m: m.group(1) + '\n                  ' + m.group(3),
        content,
        flags=re.DOTALL
    )

    # Also strip hardcoded rows from .data-table (dashboard summary tables)
    content = re.sub(
        r'(<table[^>]*class="[^"]*data-table[^"]*"[^>]*>.*?<tbody>)(.*?)(</tbody>)',
        lambda m: m.group(1) + '\n                  ' + m.group(3),
        content,
        flags=re.DOTALL
    )

    with open(filepath, 'w') as f:
        f.write(content)

    print(f"Cleaned: {os.path.basename(filepath)}")

