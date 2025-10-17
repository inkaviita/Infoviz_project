

import pandas as pd
import openpyxl
import json
import math

# Load CSV and Excel
df = pd.read_csv("globe/datasets/disasters.csv")
df2 = pd.read_excel("globe/datasets/after_2015_disasters.xlsx")

columns = ["year", "level", "disastertype", "latitude", "longitude", "country"]
df = df[columns]
df2 = df2[columns]

# Combine
df3 = pd.concat([df, df2], ignore_index=True)

# Round coordinates to 2 decimal places
df3['lat_rounded'] = df3['latitude'].round(2)
df3['lon_rounded'] = df3['longitude'].round(2)

df3 = df3[df3['level'] > 1]

# Group by year + rounded coordinates
grouped = df3.groupby(['year', 'lat_rounded', 'lon_rounded'])

aggregated = grouped.apply(lambda x: pd.Series({
    'country': x['country'].iloc[0],  # ✅ keep the first country
    'level': x['level'].sum(),        # sum of levels
    'disastertype': ', '.join(x['disastertype']),  # combine disaster types
    'latitude': x['latitude'].iloc[0],
    'longitude': x['longitude'].iloc[0]
})).reset_index()



# Save JSON
disasters_list = aggregated.to_dict(orient="records")
with open("combined_disasters_aggregated.json", "w", encoding="utf-8") as f:
    json.dump(disasters_list, f, indent=2)

print(f"Saved {len(disasters_list)} aggregated disaster records to combined_disasters_aggregated.json")
