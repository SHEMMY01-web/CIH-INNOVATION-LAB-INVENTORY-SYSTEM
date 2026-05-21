import os
import pandas as pd
import csv
from supabase import create_client, Client

url = "https://kkltrgjszsuozlrnjrnb.supabase.co"
key = "sb_publishable_XhJwMl5PFjt7uEoKqlMwxw_pXJ0vcur"
supabase: Client = create_client(url, key)

# 1. Fetch item mappings
res = supabase.table("items").select("id, item_name").execute()
item_map = {row["item_name"].strip().lower(): row["id"] for row in res.data if row["item_name"]}

# 2. Read Excel
file_path = "CIH INNOVATION LAB DAILY INVENTORY REPORT (Responses).xlsx"
df = pd.read_excel(file_path, sheet_name=0)

# Filter for Borrower report
df_filtered = df[df["Report Type"].str.lower() == "borrower report"]

csv_data = []
unmapped_items = set()

for index, row in df_filtered.iterrows():
    item_name = str(row["Item Name 2"]).strip()
    if pd.isna(row["Item Name 2"]) or not item_name or item_name.lower() == "nan":
        continue
        
    item_id = item_map.get(item_name.lower())
    if not item_id:
        unmapped_items.add(item_name)
        continue
        
    amount = 0
    if not pd.isna(row["Quantity Borrowed"]):
        try:
            amount = int(row["Quantity Borrowed"])
        except ValueError:
            pass
            
    timestamp = row["Timestamp"]
    if pd.isna(timestamp):
        timestamp = pd.Timestamp.now()
        
    csv_data.append({
        "item_id": item_id,
        "transaction_type": "checkout",
        "amount": amount,
        "requester": str(row["Borrower Name"]).strip() if not pd.isna(row["Borrower Name"]) else "Unknown",
        "project": "",
        "timestamp": timestamp.isoformat()
    })

out_df = pd.DataFrame(csv_data)
out_df.to_csv("import_transactions.csv", index=False, quoting=csv.QUOTE_MINIMAL)
print(f"Generated import_transactions.csv with {len(out_df)} rows!")

if unmapped_items:
    print(f"\nWARNING: Ignored {len(unmapped_items)} items because they were NOT found in the Supabase Items table:")
    for item in unmapped_items:
        print(f"  - {item}")
