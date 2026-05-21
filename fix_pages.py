import glob
import re

files = glob.glob("FRONTEND/JS/*.js")

for filepath in files:
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Replace the exact line with the new logic, preserving leading whitespace
    def repl(m):
        indent = m.group(1)
        return f"{indent}const rawPage = window.location.pathname.split('/').pop();\n{indent}const page = (rawPage && !rawPage.endsWith('.html')) ? rawPage + '.html' : rawPage;"

    new_content = re.sub(r'^([ \t]*)const page = window\.location\.pathname\.split\(\'/\'\)\.pop\(\);', repl, content, flags=re.MULTILINE)
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Fixed {filepath}")

