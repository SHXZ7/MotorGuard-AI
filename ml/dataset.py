import pandas as pd
import random

data = []

for _ in range(1000):

    r = random.random()

    # NORMAL (80%)
    if r < 0.8:
        rpm = random.randint(1400, 1600)
        current = round(random.uniform(0.8, 1.3), 2)
        temp = random.randint(25, 35)
        vibration = round(random.uniform(0.1, 0.3), 2)
        fault = "NORMAL"

    # OVERLOAD (7%)
    elif r < 0.87:
        rpm = random.randint(800, 1100)
        current = round(random.uniform(2.0, 3.0), 2)
        temp = random.randint(35, 50)
        vibration = round(random.uniform(0.3, 0.5), 2)
        fault = "OVERLOAD"

    # OVERHEATING (5%)
    elif r < 0.92:
        rpm = random.randint(1100, 1400)
        current = round(random.uniform(1.2, 2.0), 2)
        temp = random.randint(55, 70)
        vibration = round(random.uniform(0.2, 0.4), 2)
        fault = "OVERHEATING"

    # BEARING FAULT (5%)
    elif r < 0.97:
        rpm = random.randint(1200, 1500)
        current = round(random.uniform(1.0, 1.5), 2)
        temp = random.randint(30, 40)
        vibration = round(random.uniform(0.6, 1.0), 2)
        fault = "BEARING_FAULT"

    # STALL (3%)
    else:
        rpm = 0
        current = round(random.uniform(2.5, 3.5), 2)
        temp = random.randint(30, 45)
        vibration = round(random.uniform(0.1, 0.3), 2)
        fault = "STALL"

    data.append([rpm, current, temp, vibration, fault])

df = pd.DataFrame(data, columns=["rpm","current","temperature","vibration","fault"])

df.to_csv("motor_dataset.csv", index=False)

print("✅ Realistic dataset generated (imbalanced)")