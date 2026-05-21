import pandas as pd
df = pd.read_excel('CIH INNOVATION LAB DAILY INVENTORY REPORT (Responses).xlsx', sheet_name=0)
print("Columns:", df.columns.tolist())
print("First 3 rows:")
print(df.head(3).to_dict(orient='records'))
