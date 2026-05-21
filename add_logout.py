import glob

LOGOUT_HTML = """
      <button class="logout-btn" onclick="signOut()">
        <span class="material-symbols-outlined" style="vertical-align:middle; font-size:18px; margin-right:5px;">logout</span>Logout
      </button>
"""

TARGET = '<div class="theme-toggle">'

html_dir = "FRONTEND/HTML/"
# Only dashboard pages (not login/auth pages)
pages = ['dashboard.html', 'items.html', 'assets.html', 'project.html',
         'project_detail.html', 'request.html', 'grn_report.html', 'tools.html']

for filename in pages:
    filepath = html_dir + filename
    with open(filepath, 'r') as f:
        content = f.read()

    if 'logout-btn' in content:
        print(f"Already has logout: {filename}")
        continue

    if TARGET in content:
        content = content.replace(TARGET, LOGOUT_HTML + '      ' + TARGET)
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Added logout to: {filename}")
    else:
        print(f"WARNING - theme-toggle not found in: {filename}")

