import pandas as pd
import csv

file_path = "CIH INNOVATION LAB DAILY INVENTORY REPORT (Responses).xlsx"
df = pd.read_excel(file_path, sheet_name=0)

df_filtered = df[df["Report Type"] == "Stock purchase (Bought -In)"]

csv_data = []

for index, row in df_filtered.iterrows():
    item_name = str(row["Item Name"]).strip()
    if pd.isna(row["Item Name"]) or not item_name:
        continue
        
    amount = 0
    if not pd.isna(row["Quantity Received"]):
        try:
            amount = int(row["Quantity Received"])
        except ValueError:
            pass
            
    csv_data.append({
        "item_name": item_name,
        "model": "-",
        "type": "item:-",
        "store": "",
        "amount": amount,
        "project": "",
        "status": "available",
        "image_url": ""
    })

out_df = pd.DataFrame(csv_data)
out_df.to_csv("import_items.csv", index=False, quoting=csv.QUOTE_MINIMAL)
print(f"Generated import_items.csv with {len(out_df)} rows!")
