# REST API Design

## 1. Authentication & Authorization

The platform utilizes stateless JWT (JSON Web Tokens) for authentication, integrated with Role-Based Access Control (RBAC).

**User Roles & Permissions:**
- **Citizen**: Can view public weather/river data, receive alerts, and submit crowd-sourced disaster reports.
- **Rescue Team**: Can access detailed maps, view real-time shelter capacities, and update relief center inventory.
- **Collector (District Level)**: Can issue district-level alerts, view detailed analytical dashboards for their specific district, and manage shelters.
- **Admin (TNDMA State Level)**: Global access, user management, systemic configuration, and state-wide alerts.

## 2. REST API Endpoints

### 2.1 Authentication

**POST `/api/v1/auth/login`**
- **Method:** `POST`
- **Request:**
  ```json
  {
    "email": "collector_chennai@tn.gov.in",
    "password": "securepassword123"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "token": "eyJhbGciOiJIUzI1NiIsInR5c...",
    "user": {
      "id": "u123",
      "name": "Arun Kumar",
      "role": "Collector",
      "district_id": 15
    }
  }
  ```
- **Status Codes:** 200 OK, 401 Unauthorized

### 2.2 Dashboard

**GET `/api/v1/dashboard/summary`**
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  {
    "active_alerts": 4,
    "districts_at_risk": 2,
    "avg_state_rainfall_mm": 12.4,
    "rivers_above_danger": 1
  }
  ```

### 2.3 District Data

**GET `/api/v1/districts`**
- **Method:** `GET`
- **Response (200 OK):** Array of district objects with boundaries and population data.

**GET `/api/v1/districts/:id/status`**
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  {
    "district_id": 15,
    "name": "Chennai",
    "current_risk_score": 75.5,
    "status": "High Risk",
    "recent_alert_count": 2
  }
  ```

### 2.4 Weather & Rainfall

**GET `/api/v1/weather?district_id=15`**
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  {
    "temperature": 28.5,
    "humidity": 88,
    "condition": "Heavy Rain",
    "recorded_at": "2023-11-10T08:30:00Z"
  }
  ```

**GET `/api/v1/rainfall/trend?district_id=15&days=7`**
- **Method:** `GET`
- **Response (200 OK):** Array of daily/hourly aggregate rainfall objects.

### 2.5 River Levels

**GET `/api/v1/rivers/sensors`**
- **Method:** `GET`
- **Response (200 OK):**
  ```json
  [
    {
      "sensor_id": "s-442",
      "station": "Kallanai",
      "river": "Cauvery",
      "current_level_m": 45.2,
      "danger_level_m": 48.0,
      "trend": "rising"
    }
  ]
  ```

### 2.6 Prediction (Phase 1 Stub)

**GET `/api/v1/predictions/flood-risk?district_id=15`**
- **Method:** `GET`
- **Response (200 OK):** Returns GeoJSON feature collection of predicted flood polygons.

### 2.7 Alerts

**GET `/api/v1/alerts`**
- **Method:** `GET`
- **Response (200 OK):** List of active alerts formatted for public consumption.

**POST `/api/v1/alerts`** *(Requires Role: Admin or Collector)*
- **Method:** `POST`
- **Request:**
  ```json
  {
    "district_id": 15,
    "title": "Severe Waterlogging Warning",
    "message": "Please avoid OMR due to severe waterlogging.",
    "severity": "Critical"
  }
  ```
- **Response (201 Created):** Alert object ID and broadcast status.
- **Status Codes:** 201 Created, 403 Forbidden

### 2.8 Shelters & Safe Zones

**GET `/api/v1/shelters/nearby?lat=13.0827&lng=80.2707&radius_km=5`**
- **Method:** `GET`
- **Response (200 OK):** Array of shelter objects containing distance and current capacity, calculated via PostGIS `ST_DWithin`.

### 2.9 Reports (Crowd-sourcing)

**POST `/api/v1/reports`**
- **Method:** `POST`
- **Request:**
  ```json
  {
    "location": {"lat": 13.011, "lng": 80.222},
    "issue_type": "Waterlogging",
    "description": "Knee deep water preventing traffic."
  }
  ```
- **Response (201 Created)**

### 2.10 Admin Operations

**GET `/api/v1/admin/audit-logs`** *(Requires Role: Admin)*
- **Method:** `GET`
- **Response (200 OK):** Paginated system audit logs.
