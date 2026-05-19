import os
import glob

html_dir = "/home/olaewevictor01/INVENTORY/FRONTEND/HTML/"
files = glob.glob(os.path.join(html_dir, "*.html"))

for file in files:
    with open(file, 'r') as f:
        content = f.read()

    content = content.replace('<a href="#" class="nav-item">\n            <span class="nav-icon">📁</span> Project', '<a href="project.html" class="nav-item">\n            <span class="nav-icon">📁</span> Project')
    
    content = content.replace('<a href="#" class="nav-item">\n            <span class="nav-icon">➕</span> Request', '<a href="request.html" class="nav-item">\n            <span class="nav-icon">➕</span> Requested & Returned')
    
    content = content.replace('<a href="#" class="nav-item">\n            <span class="nav-icon">➕</span> Requested & Returned', '<a href="request.html" class="nav-item">\n            <span class="nav-icon">➕</span> Requested & Returned')
    
    content = content.replace('<a href="#" class="nav-item">\n            <span class="nav-icon">📦</span> On hand', '<a href="on_hand.html" class="nav-item">\n            <span class="nav-icon">📦</span> On hand')
    
    content = content.replace('<a href="#" class="nav-item">\n            <span class="nav-icon">📄</span> GRN Report', '<a href="grn_report.html" class="nav-item">\n            <span class="nav-icon">📄</span> GRN Report')

    with open(file, 'w') as f:
        f.write(content)

