import os
import pandas as pd
from supabase import create_client, Client

url = "https://kkltrgjszsuozlrnjrnb.supabase.co"
key = "sb_publishable_XhJwMl5PFjt7uEoKqlMwxw_pXJ0vcur"
supabase: Client = create_client(url, key)

def wipe_table(table_name):
    print(f"Wiping table: {table_name}")
    try:
        # Fetch all records
        res = supabase.table(table_name).select("id").execute()
        records = res.data
        if not records:
            print(f"  Table {table_name} is already empty.")
            return
        
        # Delete each record
        for row in records:
            supabase.table(table_name).delete().eq("id", row["id"]).execute()
        print(f"  Deleted {len(records)} records from {table_name}.")
    except Exception as e:
        print(f"  Error wiping {table_name}: {e}")

def run_migration():
    # 1. Wipe data
    wipe_table("transactions")
    wipe_table("projects")
    wipe_table("items")
    
    # 2. Read Excel
    print("\nReading Excel file...")
    file_path = "CIH INNOVATION LAB DAILY INVENTORY REPORT (Responses).xlsx"
    df = pd.read_excel(file_path, sheet_name=0)
    
    # 3. Filter for Stock purchases
    print("Filtering rows...")
    df_filtered = df[df["Report Type"] == "Stock purchase (Bought -In)"]
    print(f"Found {len(df_filtered)} items to import.")
    
    # 4. Insert into Supabase
    print("Inserting items into database...")
    success_count = 0
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
                
        item_data = {
            "item_name": item_name,
            "model": "-",
            "type": "item:-",
            "store": "",
            "amount": amount,
            "project": "",
            "status": "available",
            "image_url": ""
        }
        
        try:
            res = supabase.table("items").insert([item_data]).execute()
            success_count += 1
        except Exception as e:
            print(f"  Error inserting {item_name}: {e}")
            
    print(f"\nMigration complete! Successfully inserted {success_count} items.")

if __name__ == "__main__":
    run_migration()
