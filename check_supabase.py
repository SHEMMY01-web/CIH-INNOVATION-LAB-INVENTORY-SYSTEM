import os
from supabase import create_client, Client

url = "https://kkltrgjszsuozlrnjrnb.supabase.co"
key = "sb_publishable_XhJwMl5PFjt7uEoKqlMwxw_pXJ0vcur"
supabase: Client = create_client(url, key)

try:
    res = supabase.table("items").select("id, item_name").execute()
    print(f"Successfully fetched {len(res.data)} items.")
    if len(res.data) > 0:
        print(res.data[:3])
except Exception as e:
    print(f"Error fetching items: {e}")
