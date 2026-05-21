import pandas as pd

file_path = "CIH INNOVATION LAB DAILY INVENTORY REPORT (Responses).xlsx"
df = pd.read_excel(file_path, sheet_name=0)

print("Unique Report Types:")
print(df["Report Type"].unique())

# Also print columns for borrowed/return to understand mapping
print("\nSample borrowed row:")
borrowed_df = df[df["Report Type"].astype(str).str.contains("borrow", case=False, na=False)]
if not borrowed_df.empty:
    print(borrowed_df[['Timestamp', 'Date borrowed', 'Borrower Name', 'Item Name 2', 'Quantity Borrowed', 'Expected Return date']].head(1).to_dict(orient='records'))
