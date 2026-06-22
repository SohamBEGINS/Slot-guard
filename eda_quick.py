import pandas as pd

df = pd.read_csv('c:/Users/Lenovo/Desktop/model_building_slot_project/final_ml_dataset.csv')

print('=== UNIQUE VALUES ===')
print('zone_id:', sorted(df['zone_id'].unique()))
print('Weather_Severity:', sorted(df['Weather_Severity'].unique()))
print('Traffic_Encoded:', sorted(df['Traffic_Encoded'].unique()))
print(f'Total rows: {len(df)}')

print('\n=== STATS PER ZONE ===')
for z in sorted(df['zone_id'].unique()):
    zdf = df[df['zone_id'] == z]
    print(f'Zone {z}: Current_Load median={zdf.Current_Load.median():.0f}, mean={zdf.Current_Load.mean():.1f}, '
          f'min={zdf.Current_Load.min()}, max={zdf.Current_Load.max()}, '
          f'Total_Demand median={zdf.Total_Demand.median():.0f}, mean={zdf.Total_Demand.mean():.1f}')

print('\n=== TRAFFIC DISTRIBUTION ===')
print(df['Traffic_Encoded'].value_counts().sort_index())

print('\n=== WEATHER DISTRIBUTION ===')
print(df['Weather_Severity'].value_counts().sort_index())

print('\n=== CURRENT_LOAD OVERALL STATS ===')
print(df['Current_Load'].describe())

print('\n=== DEMAND vs CURRENT_LOAD CORRELATION ===')
print(f'Pearson r = {df.Current_Load.corr(df.Total_Demand):.4f}')

# What does "typical" hour look like per zone?
# Reverse engineer hour from sin/cos
import numpy as np
df['Hour_approx'] = np.round(np.arctan2(df['Hour_Sin'], df['Hour_Cos']) * 12 / np.pi) % 24
df['Hour_approx'] = df['Hour_approx'].astype(int)

print('\n=== LOAD BY HOUR (averaged across all zones, normal conditions only) ===')
normal = df[(df['Is_Festival'] == 0) & (df['Weather_Severity'] == 1.0) & (df['Traffic_Encoded'] == 1.0)]
hour_stats = normal.groupby('Hour_approx').agg(
    avg_load=('Current_Load', 'mean'),
    avg_demand=('Total_Demand', 'mean'),
    count=('Current_Load', 'count')
).round(1)
print(hour_stats)

print('\n=== BASELINE LOAD PER ZONE (normal conditions, all hours) ===')
zone_baseline = normal.groupby('zone_id').agg(
    avg_load=('Current_Load', 'mean'),
    median_load=('Current_Load', 'median'),
    p75_load=('Current_Load', lambda x: x.quantile(0.75)),
    avg_demand=('Total_Demand', 'mean'),
    count=('Current_Load', 'count')
).round(1)
print(zone_baseline)

print('\n=== TRAFFIC ENCODED MAPPING (value -> demand multiplier effect) ===')
for t in sorted(df['Traffic_Encoded'].unique()):
    tdf = df[df['Traffic_Encoded'] == t]
    base = df[df['Traffic_Encoded'] == 1.0]['Total_Demand'].mean()
    print(f'Traffic={t}: avg_demand={tdf.Total_Demand.mean():.1f}, multiplier_vs_base={tdf.Total_Demand.mean()/base:.2f}x')
