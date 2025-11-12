import pandas as pd
import json

# Load disasters
df = pd.read_csv("globe/datasets/disasters.csv")
df2 = pd.read_excel("globe/datasets/after_2015_disasters.xlsx")
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

with open("globe/datasets/normalized_emissions.json") as f:
    emissions_data = json.load(f)

def get_emissions(country, year):
    country_data = emissions_data.get(country, [])
    for record in country_data:
        if record["year"] == year:
            return record["raw"] 
    return 0

aggregated["emissions"] = aggregated.apply(
    lambda row: get_emissions(row["country"], row["year"]),
    axis=1
)

aggregated = aggregated.sort_values(["country", "year"]).reset_index(drop=True)

cumulative_rows = []
for country, group in aggregated.groupby("country"):
    group = group.sort_values("year")
    group["cum_disasters"] = group["num_disasters"].cumsum()
    group["cum_level"] = group["total_level"].cumsum()
    group["cum_emissions"] = group["emissions"].cumsum()

    # Compute cumulative ratio — the “suffering index”
    group["suffering_index"] = group.apply(
        lambda r: (r["cum_level"] / (r["cum_emissions"] / 1e9))
        if r["cum_emissions"] > 0 else 0,
        axis=1
    )

    cumulative_rows.append(group)


aggregated_cumulative = pd.concat(cumulative_rows, ignore_index=True)

# === Save JSON output ===
output_path = "globe/combined_disasters_suffering.json"
disasters_list = aggregated_cumulative.to_dict(orient="records")

with open(output_path, "w") as f:
    json.dump(disasters_list, f, indent=2)

print(f"Saved cumulative suffering data to {output_path}")
