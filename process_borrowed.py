import os
import re
import pandas as pd
import csv
import difflib
from supabase import create_client, Client

url = "https://kkltrgjszsuozlrnjrnb.supabase.co"
key = "sb_publishable_XhJwMl5PFjt7uEoKqlMwxw_pXJ0vcur"
supabase: Client = create_client(url, key)

# Direct Aliases requested by user
ALIASES = {
    "headset": "headphone",
    "disposable ear-piece": "disposable ear piece",
    "we-do kit": "we-do 2.0",
    "jumper cables": "jumper cables (male - male, female - female, male - female)",
    "jumper cable": "jumper cables (male - male, female - female, male - female)",
    "df card reader": "mp3 sd card",
    "switch": "power switch",
    "charger": "charger head (asus)",
    "light dependent resistor": "light dependent resistor",
    "led": "led light",
    "soil sensor": "soil sensor"
}

print("Fetching items from Supabase...")
res = supabase.table("items").select("id, item_name").execute()
db_items = {}
for row in res.data:
    if row.get("item_name"):
        db_items[row["item_name"].strip().lower()] = row["id"]

# Reverse lookup for correct capitalization in output
db_name_map = {name.lower(): name for name in db_items.keys()}

print(f"Loaded {len(db_items)} items from database.")

file_path = "CIH INNOVATION LAB DAILY INVENTORY REPORT (Responses).xlsx"
df = pd.read_excel(file_path, sheet_name=0)
df_filtered = df[df["Report Type"].astype(str).str.lower() == "borrower report"]

transactions = []
returns = []
missing_items = set()

# Helper to fuzzy match
def find_item_id(raw_name):
    clean_name = str(raw_name).strip().lower()
    
    # Check alias
    if clean_name in ALIASES:
        clean_name = ALIASES[clean_name]
        
    # Exact match
    if clean_name in db_items:
        return db_items[clean_name], db_name_map[clean_name]
        
    # Fuzzy match
    matches = difflib.get_close_matches(clean_name, db_items.keys(), n=1, cutoff=0.85)
    if matches:
        matched_name = matches[0]
        print(f"  Fuzzy Match: '{raw_name}' ➔ '{db_name_map[matched_name]}'")
        return db_items[matched_name], db_name_map[matched_name]
        
    return None, str(raw_name).strip()

def extract_qty(text, default_qty):
    # Matches strings like "Item (5)", "Item 5", "5 Item", "40 Jumper Cables"
    text = str(text).strip()
    
    # Check "(5)" pattern
    match = re.search(r'\((\d+)\)', text)
    if match:
        qty = int(match.group(1))
        name = re.sub(r'\(\d+\)', '', text).strip()
        return name, qty
        
    # Check leading number pattern e.g. "5 Servo"
    match = re.search(r'^(\d+)\s+(.*)', text)
    if match:
        qty = int(match.group(1))
        name = match.group(2).strip()
        return name, qty
        
    return text, default_qty

for index, row in df_filtered.iterrows():
    raw_item_cell = str(row["Item Name 2"])
    if raw_item_cell.lower() == "nan" or not raw_item_cell.strip():
        continue
        
    default_qty = 1
    if not pd.isna(row["Quantity Borrowed"]):
        try:
            default_qty = int(row["Quantity Borrowed"])
        except ValueError:
            pass
            
    timestamp = row["Timestamp"] if not pd.isna(row["Timestamp"]) else pd.Timestamp.now()
    expected_return_date = row.get("Expected Return date")
    
    requester = str(row["Borrower Name"]).strip() if not pd.isna(row["Borrower Name"]) else "Unknown"
    
    # Split by comma or "and"
    # "Arduino Uno, Bread-board, Led, Jumper cables, resistor, Switch." -> ["Arduino Uno", "Bread-board"...]
    # Also handle "3D pen and charger" -> ["3D pen", "charger"]
    
    # Normalize separators
    split_string = raw_item_cell.replace(" and ", ",").replace(".", "")
    pieces = [p.strip() for p in split_string.split(",") if p.strip()]
    
    for piece in pieces:
        # Check if qty is specified in parenthesis
        piece_name, piece_qty = extract_qty(piece, default_qty)
        
        item_id, matched_name = find_item_id(piece_name)
        
        if item_id:
            transactions.append({
                "item_id": item_id,
                "transaction_type": "checkout",
                "amount": piece_qty,
                "requester": requester,
                "project": "",
                "timestamp": timestamp.isoformat()
            })
            
            if pd.notna(expected_return_date):
                returns.append({
                    "item_id": item_id,
                    "transaction_type": "return",
                    "amount": piece_qty,
                    "requester": requester,
                    "project": "",
                    "timestamp": expected_return_date.isoformat()
                })
        else:
            print(f"  MISSING: '{piece_name}' (from '{raw_item_cell}')")
            missing_items.add(piece_name)

# Generate Transactions CSV (Checkouts)
if transactions:
    tx_df = pd.DataFrame(transactions)
    tx_df.to_csv("import_transactions.csv", index=False, quoting=csv.QUOTE_MINIMAL)
    print(f"\n✅ Generated import_transactions.csv (Checkouts) with {len(tx_df)} rows!")

# Generate Returns CSV
if returns:
    ret_df = pd.DataFrame(returns)
    ret_df.to_csv("import_returns.csv", index=False, quoting=csv.QUOTE_MINIMAL)
    print(f"✅ Generated import_returns.csv (Returns) with {len(ret_df)} rows!")

# Generate Missing Items CSV
if missing_items:
    missing_data = []
    for m_item in missing_items:
        missing_data.append({
            "item_name": m_item,
            "model": "-",
            "type": "item:-",
            "store": "",
            "amount": 1,
            "project": "",
            "status": "available",
            "image_url": ""
        })
    m_df = pd.DataFrame(missing_data)
    m_df.to_csv("import_missing_items.csv", index=False, quoting=csv.QUOTE_MINIMAL)
    print(f"⚠️ Generated import_missing_items.csv with {len(m_df)} new items!")
    print("\nACTION REQUIRED: Import `import_missing_items.csv` into the 'items' table FIRST.")
    print("Then, import BOTH `import_transactions.csv` and `import_returns.csv` into the 'transactions' table.")
else:
    print("\n🎉 No missing items found! You can proceed to import the transactions.")
