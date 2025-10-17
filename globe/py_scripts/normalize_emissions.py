import pandas as pd
import json

# Load your dataset
df = pd.read_csv("C:/Users/Inka Viita/Desktop/Threejs_sketches/globe/emissions.csv")  # or whatever your file is

# Normalize per year
df["Normalized"] = df.groupby("Year")["Annual CO₂ emissions"].transform(lambda x: x / x.max())

# Keep relevant columns
normalized_df = df[["Entity", "Code", "Year", "Normalized", "Annual CO₂ emissions"]]

# Convert to nested dictionary: { "Country": [{year:..., value:...}, ...] }
output = {}

for country, group in normalized_df.groupby("Entity"):
    output[country] = group.rename(columns={
        "Year": "year",
        "Normalized": "value",
        "Annual CO₂ emissions": "raw"
    })[["year", "value", "raw"]].to_dict(orient="records")
    
# Save to JSON
with open("normalized_emissions.json", "w") as f:
    json.dump(output, f, indent=2)
