# FloodSense AI - Architecture & System Design

## 1. Enterprise Architecture Overview

The FloodSense AI platform is designed as a highly scalable, fault-tolerant, and secure microservices-based enterprise architecture to handle government-scale traffic, especially during disaster events.

```mermaid
graph TD
    Client[Client Applications - Web/Mobile] --> |HTTPS/WSS| API_Gateway[API Gateway / Load Balancer]
    
    subgraph "API Layer"
        API_Gateway --> Auth[Auth Service]
        API_Gateway --> CoreAPI[Core Backend Service]
        API_Gateway --> GISAPI[GIS / Map Service]
        API_Gateway --> MLAPI[ML Inference Service - Future]
    end
    
    subgraph "Application Services"
        CoreAPI --> UserMgmt[User Management]
        CoreAPI --> AlertMgmt[Alert & Notification Service]
        CoreAPI --> DataIngest[Data Ingestion Service]
        CoreAPI --> DashboardSvc[Dashboard Analytics]
    end
    
    subgraph "Data Collection Layer"
        DataIngest --> IMD[IMD APIs]
        DataIngest --> TNSDMA[TNSDMA Feeds]
        DataIngest --> Sensors[IoT River Sensors]
    end
    
    subgraph "Data Storage"
        UserMgmt -.-> DB[(PostgreSQL + PostGIS)]
        AlertMgmt -.-> DB
        DataIngest -.-> DB
        CoreAPI -.-> Cache[(Redis Cache)]
        MLAPI -.-> GraphDB[(Neo4j - Future)]
    end
    
    subgraph "Infrastructure & Monitoring"
        Prometheus[Prometheus + Grafana]
        ELK[ELK Stack for Logging]
    end
```

## 2. Technology Stack & Rationale

### Frontend
- **Framework**: Next.js (React) - Selected for Server-Side Rendering (SSR) capabilities, crucial for SEO and fast initial load times during critical emergencies.
- **Styling**: Tailwind CSS - Rapid UI development with strict adherence to the design system.
- **Maps**: Mapbox GL JS / React Leaflet - WebGL powered rendering, essential for smooth handling of heavy GIS layers (flood plains, DEM).
- **Charts**: Recharts / Chart.js - For robust visualization of river levels and rainfall trends.

### Backend
- **Primary API**: Node.js with NestJS - Highly scalable, strongly typed (TypeScript), and enforces enterprise-grade modular architecture.
- **Data/ML API**: Python (FastAPI) - For future-proofing AI integrations and intensive GIS/array data processing.
- **Authentication**: Keycloak or Auth0 - OIDC compliant, RBAC-ready, secure identity management.

### Database
- **Relational & GIS**: PostgreSQL with PostGIS - The industry standard for combined relational data and advanced spatial queries (e.g., finding shelters within a 5km radius of a flood zone).
- **Caching**: Redis - In-memory caching for live weather and river telemetry to reduce DB load under spike traffic.

### Notification Service
- **Providers**: Twilio (SMS/WhatsApp), Firebase Cloud Messaging (FCM) for mobile push, SendGrid (Email).
- **Message Broker**: Apache Kafka or RabbitMQ - For reliable async message queuing during mass alert broadcasts.

### Deployment & DevOps
- **Containerization**: Docker & Kubernetes (EKS/GKE) - Auto-scaling during disaster events when traffic spikes unrecognizably.
- **CI/CD**: GitHub Actions - Automated testing, linting, and container registry pushing.
- **Monitoring**: Prometheus (Metrics) & Grafana (Dashboards).
- **Logging**: Elasticsearch, Logstash, Kibana (ELK) or Datadog.

## 3. High-Level Architecture (HLA)

```mermaid
graph LR
    A[Web/Mobile Client] <--> B[CDN / Cloudflare]
    B <--> C[Nginx Ingress / API Gateway]
    C <--> D[Microservices Cluster]
    D <--> E[(Primary Database)]
    D <--> F[(Redis Cache)]
    D <--> G[3rd Party APIs - Weather/SMS]
```

## 4. Component Diagram

```mermaid
componentDiagram
    package "Frontend (Next.js)" {
        [Dashboard UI]
        [GIS Map Viewer]
        [Alert Dashboard]
    }
    
    package "Backend (NestJS)" {
        [Auth Controller]
        [GIS Controller]
        [Telemetry Processor]
        [Notification Engine]
    }
    
    package "Data Layer" {
        [PostgreSQL / PostGIS]
        [Redis Cache]
    }
    
    [Dashboard UI] --> [Auth Controller]
    [GIS Map Viewer] --> [GIS Controller]
    [Telemetry Processor] --> [PostgreSQL / PostGIS]
    [Notification Engine] --> [Redis Cache]
```

## 5. Deployment Diagram

```mermaid
graph TD
    subgraph AWS / Cloud Provider
        subgraph Public Subnet
            ALB[Application Load Balancer]
        end
        subgraph Private Subnet (Kubernetes EKS)
            UI[Frontend Pods]
            API[Backend Pods]
            Worker[Background Workers]
        end
        subgraph Data Subnet
            RDS[Amazon RDS Multi-AZ PostgreSQL]
            ElastiCache[ElastiCache Redis]
        end
    end
    Internet --> ALB
    ALB --> UI
    ALB --> API
    API --> RDS
    API --> ElastiCache
    Worker --> RDS
```

## 6. Data Flow Diagram

```mermaid
graph TD
    ExternalSource(Weather Stations / Sensors) --> |Raw Telemetry| Ingestion[Ingestion Service]
    Ingestion --> |Standardize & Clean| Kafka[Message Queue]
    Kafka --> |Subscribe| DBWriter[DB Persister]
    DBWriter --> Postgres[(PostGIS DB)]
    Kafka --> |Subscribe| RuleEngine[Alert Rule Engine]
    RuleEngine --> |Threshold Exceeded| Notifier[Notification Service]
    Notifier --> User(Registered Citizens / Officials)
```

## 7. Sequence Diagram: Flood Alert

```mermaid
sequenceDiagram
    participant S as River Sensor
    participant I as Ingestion API
    participant R as Rule Engine
    participant DB as Database
    participant N as Notification Svc
    participant U as Citizen App

    S->>I: Send Water Level Data (JSON)
    I->>DB: Store Telemetry
    I->>R: Trigger Threshold Check
    R->>DB: Get District Thresholds
    alt Level > Danger Mark
        R->>DB: Create Alert Record
        R->>N: Dispatch Alert Payload
        N->>U: Push Notification / SMS
    end
```

## 8. Data Sources (Tamil Nadu)

To function accurately, the system relies on the following Tamil Nadu specific datasets:

1. **Weather & Rainfall**: IMD (Indian Meteorological Department) API, TNSDMA AWS (Automatic Weather Stations). Download: IMD Pune portal.
2. **Digital Elevation Model (DEM)**: ISRO Bhuvan (Cartosat-1 30m DEM) or SRTM 30m for flood mapping and slope calculations. Download: Bhuvan / EarthExplorer.
3. **River/Catchment Geometries**: India WRIS (Water Resources Information System) - Cauvery, Vaigai, Thamirabarani basins.
4. **Historical Flood Data**: TNSDMA past disaster reports, Copernicus Emergency Management Service.
5. **District & Taluk Boundaries**: Survey of India / Tamil Nadu GIS portal (Shapefiles/GeoJSON).
6. **Population Density**: Census of India (gridded population data).
7. **Shelters & Hospitals**: Local government municipal data / OpenStreetMap (OSM) exports for TN.
8. **Road Networks**: OpenStreetMap (OSM) for routing and identifying flood-prone closures.

*Note: In Phase 1, sample subsets of these datasets will be mocked or manually ingested into PostGIS for foundational API and UI testing.*
