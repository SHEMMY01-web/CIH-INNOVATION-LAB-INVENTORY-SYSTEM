import os
import glob

html_dir = "/home/olaewevictor01/INVENTORY/FRONTEND/HTML/"
files = glob.glob(os.path.join(html_dir, "*.html"))

full_scripts = """
    <!-- Supabase Client & App Logic -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="/FRONTEND/JS/auth.js"></script>
    <script src="/FRONTEND/JS/search.js"></script>
    <script src="/FRONTEND/JS/mutations.js"></script>
    <script src="/FRONTEND/JS/inventory.js"></script>
  </body>"""

auth_scripts = """
    <!-- Supabase Client & App Logic -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="/FRONTEND/JS/auth.js"></script>
  </body>"""

auth_pages = ['index.html', 'enter_otp.html', 'forgot_password.html', 'login_successful.html']

for file in files:
    with open(file, 'r') as f:
        content = f.read()

    # Avoid duplicate injections
    if '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>' in content:
        continue

    basename = os.path.basename(file)
    if basename in auth_pages:
        content = content.replace('</body>', auth_scripts)
    else:
        content = content.replace('</body>', full_scripts)

    with open(file, 'w') as f:
        f.write(content)

