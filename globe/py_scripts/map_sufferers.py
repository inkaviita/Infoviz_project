import pandas as pd
import json

# Load disasters
df = pd.read_csv("globe/disasters.csv")
df2 = pd.read_excel("globe/after_2015_disasters.xlsx")
columns = ["year", "level", "disastertype", "latitude", "longitude", "country"]
df = df[columns]
df2 = df2[columns]
df3 = pd.concat([df, df2], ignore_index=True)

# Aggregate per country-year
aggregated = (
    df3.groupby(["country", "year"])
    .apply(lambda x: pd.Series({
        "total_level": x["level"].sum(),
        "num_disasters": len(x),
        "disaster_types": ", ".join(x["disastertype"].unique())
    }))
    .reset_index()
)

# Load emissions
with open("globe/normalized_emissions.json") as f:
    emissions_data = json.load(f)

def get_emissions(country, year):
    country_data = emissions_data.get(country, [])
    for record in country_data:
        if record["year"] == year:
            return record["raw"]  # Use raw value
    return 0  # fallback to 0 if missing

# Assign emissions safely
aggregated["emissions"] = aggregated.apply(
    lambda row: get_emissions(row["country"], row["year"]),
    axis=1
)

# Compute suffering index safely (avoid division by zero)
aggregated["suffering_index"] = aggregated.apply(
    lambda row: (row["total_level"]) if row["emissions"] > 0 else 0,
    axis=1
)

#  / (row["emissions"] + 1e6)


# Save
output_path = "combined_disasters_suffering.json"
disasters_list = aggregated.to_dict(orient="records")
with open(output_path, "w") as f:
    json.dump(disasters_list, f, indent=2)
