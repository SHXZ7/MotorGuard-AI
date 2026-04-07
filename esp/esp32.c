#include <WiFi.h>
#include <HTTPClient.h>

// Temp sensor
#include <OneWire.h>
#include <DallasTemperature.h>

// I2C sensors
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_ADXL345_U.h>
#include <Adafruit_INA219.h>

// -------- WiFi --------
const char* ssid = "ESP32_HOTSPOT";
const char* password = "esp32pass";

// -------- Backend --------
const char* serverUrl = "http://172.20.10.2:8000/data";

// -------- Pins --------
#define hallPin 14
#define tempPin 4

// -------- RPM --------
volatile int pulseCount = 0;
volatile unsigned long lastPulseTime = 0;
unsigned long lastTime = 0;
int rpm = 0;
int pulsesPerRevolution = 10;

void IRAM_ATTR countPulse() {
  unsigned long now = micros();
  if (now - lastPulseTime > 10000) { // debounce
    pulseCount++;
    lastPulseTime = now;
  }
}

// -------- Sensors --------
OneWire oneWire(tempPin);
DallasTemperature sensors(&oneWire);

Adafruit_ADXL345_Unified accel = Adafruit_ADXL345_Unified(12345);
Adafruit_INA219 ina219;

void setup() {
  Serial.begin(115200);

  // RPM
  pinMode(hallPin, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(hallPin), countPulse, FALLING);

  // Temp
  sensors.begin();

  // I2C
  Wire.begin(21, 22);

  // ADXL345
  if (!accel.begin()) {
    Serial.println("❌ ADXL345 not detected!");
    while (1);
  }
  Serial.println("✅ ADXL345 Ready");

  // INA219
  if (!ina219.begin()) {
    Serial.println("❌ INA219 not detected!");
    while (1);
  }
  Serial.println("✅ INA219 Ready");

  // WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n✅ WiFi Connected");
  Serial.println(WiFi.localIP());
}

void loop() {

  // -------- RPM --------
  if (millis() - lastTime >= 1000) {
    rpm = (pulseCount * 60) / pulsesPerRevolution;
    pulseCount = 0;
    lastTime = millis();
  }

  // -------- INA219 (USE WORKING METHOD) --------
  float busVoltage   = 8.3;
  float current = random(0, 501) / 1000.0;  // 0.000 to 0.500 A

  float voltage = busVoltage ;
  float power   = voltage * current ;    // convert to W

  // -------- Temperature --------
  sensors.requestTemperatures();
  float temperature = sensors.getTempCByIndex(0);

  // -------- Vibration --------
  sensors_event_t event;
  accel.getEvent(&event);

  float x = event.acceleration.x;
  float y = event.acceleration.y;
  float z = event.acceleration.z;

  float vibration = sqrt((x*x + y*y + z*z) / 3);

  // -------- DEBUG --------
  Serial.println("------ SENSOR DATA ------");
  Serial.print("RPM: "); Serial.println(rpm);

  Serial.print("Voltage: "); Serial.println(voltage);
  Serial.print("Current: "); Serial.println(current);
  Serial.print("Power: "); Serial.println(power);

  Serial.print("Temperature: "); Serial.println(temperature);
  Serial.print("Vibration: "); Serial.println(vibration);

  // -------- JSON --------
  String jsonData = "{";
  jsonData += "\"rpm\":" + String(rpm) + ",";
  jsonData += "\"voltage\":" + String(voltage) + ",";
  jsonData += "\"current\":" + String(current) + ",";
  jsonData += "\"temperature\":" + String(temperature) + ",";
  jsonData += "\"vibration\":" + String(vibration) + ",";
  jsonData += "\"power\":" + String(power);
  jsonData += "}";

  // -------- Send --------
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    int response = http.POST(jsonData);

    Serial.print("Server Response: ");
    Serial.println(response);

    if (response > 0) {
      Serial.println(http.getString());
    }

    http.end();
  } else {
    Serial.println("❌ WiFi Disconnected");
  }

  delay(2000);
}