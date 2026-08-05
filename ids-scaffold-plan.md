# IDS Scaffold Plan
## Real-Time Intrusion Detection System — B.Tech Major Project

### Top-Level Overview

Build a production-shaped, Dockerised, real-time Network Intrusion Detection System from a completely empty repository. The system ingests live or replayed network traffic, extracts flow-level features, runs a two-stage hybrid ML detection engine (XGBoost classifier → Autoencoder anomaly detector), explains every alert with SHAP, persists data in PostgreSQL+TimescaleDB, streams live events over WebSocket, and displays them on a React/TypeScript dashboard. Watson integration hooks are reserved for a later phase.

**Scope of this plan:** repository scaffold only — folder structure, backend skeleton (FastAPI routes/endpoints), ML model stubs with TODO comments, dependency files, and Docker Compose. No model training, no real feature extraction logic, no frontend implementation yet.

---

### Architecture Decision Record

| Concern | Choice | Reason |
|---|---|---|
| Backend API | FastAPI (Python) | Async-native, built-in WebSocket, auto OpenAPI docs, ideal for ML serving |
| Streaming / queue | Redis Streams | Single lightweight container, sufficient demo throughput, simple consumer API |
| Persistent store | PostgreSQL + TimescaleDB | Hypertables for time-series flow/alert data, JSONB for SHAP values, full SQL for joins |
| In-memory state | Redis (same instance) | Live alert cache, deduplication window |
| Supervised classifier | XGBoost | Best accuracy on tabular flow features, native SHAP TreeExplainer |
| Anomaly detector | Keras Autoencoder | Reconstruction-error threshold on normal-only training data for zero-day detection |
| Explainability | SHAP (TreeExplainer for Stage 1) | Per-alert feature importance, stored as JSONB |
| Frontend | React (TypeScript) + Recharts | Polished SPA, WebSocket client, live charts |
| Containerisation | Docker + Docker Compose | One-command spin-up of all services |

---

### Proposed Folder Structure

```
ids-project/
├── ingestion/                  # Packet capture & pcap replay
│   ├── __init__.py
│   ├── capture.py              # Live capture (Scapy / pyshark) — toggled by env var
│   ├── replay.py               # pcap replay for demo
│   └── producer.py             # Pushes raw packets / flow tuples to Redis Stream
│
├── feature_extraction/         # Flow-level feature computation
│   ├── __init__.py
│   ├── flow_builder.py         # Assembles bidirectional flows from packets
│   ├── feature_names.py        # Canonical list of 78 CICFlowMeter-style feature names
│   └── extractor.py            # Converts flow objects → normalised feature vectors
│
├── ml/                         # ML model definitions, stubs, and inference
│   ├── __init__.py
│   ├── classifier.py           # Stage 1: XGBoost multi-class (stub)
│   ├── anomaly_detector.py     # Stage 2: Keras Autoencoder (stub)
│   ├── explainer.py            # SHAP TreeExplainer wrapper (stub)
│   ├── pipeline.py             # Orchestrates Stage 1 → Stage 2 → SHAP
│   └── artifacts/              # Saved model files (.ubj, .keras, scaler.pkl)
│       └── .gitkeep
│
├── api/                        # FastAPI application
│   ├── __init__.py
│   ├── main.py                 # App factory, lifespan, middleware
│   ├── dependencies.py         # Shared FastAPI dependencies (DB session, Redis)
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── ingestion.py        # POST /ingest/flow, POST /ingest/pcap
│   │   ├── prediction.py       # POST /predict, POST /predict/batch
│   │   ├── alerts.py           # GET /alerts, GET /alerts/{id}, DELETE /alerts/{id}
│   │   ├── health.py           # GET /health, GET /health/ready
│   │   └── ws.py               # WebSocket /ws/alerts, /ws/traffic
│   └── schemas/
│       ├── __init__.py
│       ├── flow.py             # Pydantic models for flow feature input
│       └── alert.py            # Pydantic models for alert output
│
├── db/                         # Database layer
│   ├── __init__.py
│   ├── session.py              # SQLAlchemy async engine + session factory
│   ├── models.py               # ORM models: FlowRecord, Alert
│   └── migrations/             # Alembic migration scripts
│       └── env.py
│
├── workers/                    # Background consumer processes
│   ├── __init__.py
│   ├── flow_consumer.py        # Reads from Redis Stream → feature extraction → ML pipeline
│   └── alert_broadcaster.py   # Pushes new alerts to WebSocket connections
│
├── frontend/                   # React TypeScript SPA
│   ├── public/
│   ├── src/
│   │   ├── components/         # TrafficFeed, AlertPanel, SeverityGauge, ...
│   │   ├── hooks/              # useWebSocket, useAlerts
│   │   ├── pages/              # Dashboard, AlertDetail
│   │   ├── api/                # REST client (axios)
│   │   └── main.tsx
│   ├── package.json
│   └── tsconfig.json
│
├── scripts/                    # Training script stubs (next phase)
│   ├── train_classifier.py     # TODO stub — XGBoost training on CICIDS2017
│   └── train_autoencoder.py    # TODO stub — Autoencoder training on normal traffic only
│
├── docker/
│   ├── Dockerfile.api          # Multi-stage Python image (includes libpcap/tshark)
│   ├── Dockerfile.worker       # Python worker image (includes libpcap/tshark)
│   └── Dockerfile.frontend     # Node build → nginx serve
│
├── docker-compose.yml          # Orchestrates: api, worker, frontend, postgres+timescale, redis
├── .env.example                # Environment variable template
├── requirements.txt            # Python dependencies (pinned)
├── requirements-dev.txt        # Dev/test extras
└── README.md
```

---

## Sub-Tasks

---

### Sub-Task 1 — Repository Skeleton & Folder Structure

**Intent:** Create all directories, `__init__.py` files, and placeholder stubs so that every subsequent sub-task has a stable home. This makes imports resolvable from day one.

**Expected Outcomes:**
- All directories above exist with correct `__init__.py` files
- `ml/artifacts/.gitkeep` present
- `README.md` with project title and a brief description

**Todo List:**
1. Create every directory listed in the folder structure above, including the new `scripts/` and `tests/` directories
2. Add an empty `__init__.py` to each Python package directory
3. Add `ml/artifacts/.gitkeep`
4. Write a minimal `README.md` with project title, one-paragraph description, and a "Getting Started" placeholder section
5. Write `.gitignore` covering: `node_modules/`, `__pycache__/`, `.env`, `venv/`, `.venv/`, `*.pyc`, `ml/artifacts/*.ubj`, `ml/artifacts/*.keras`, `ml/artifacts/*.pkl`, `.pytest_cache/`, `dist/`, `build/`
6. Write `tests/__init__.py` (empty) and `tests/test_placeholder.py` with one passing dummy test

**Relevant Context:** Greenfield repo — no existing files. The `scripts/` directory is not a Python package (no `__init__.py`) — it contains standalone executable scripts. The `tests/` directory is a Python package so pytest can discover it.

**Status:** [ ] pending

---

### Sub-Task 2 — Python Dependency Files

**Intent:** Pin all core Python libraries so the project is reproducible and Docker builds are deterministic.

**Expected Outcomes:**
- `requirements.txt` lists all production dependencies with pinned major versions
- `requirements-dev.txt` lists testing/linting extras

**Todo List:**
1. Write `requirements.txt` with the following groups (use latest stable pinned versions):
   - **API:** `fastapi`, `uvicorn[standard]`, `websockets`
   - **Data / ML:** `numpy`, `pandas`, `scikit-learn`, `xgboost`, `tensorflow` (for Keras autoencoder), `shap`
   - **Network capture:** `scapy`, `pyshark`
   - **Database:** `sqlalchemy[asyncio]`, `asyncpg`, `alembic`
   - **Redis:** `redis[hiredis]`
   - **Serialisation:** `pydantic`, `orjson`
   - **Utilities:** `python-dotenv`, `structlog`
2. Write `requirements-dev.txt` with: `pytest`, `pytest-asyncio`, `httpx`, `black`, `ruff`, `mypy`

**Relevant Context:** Python 3.11+ target. TensorFlow chosen over PyTorch for Keras Autoencoder because Keras 3 API is cleaner for simple autoencoder architectures and SHAP integration is well-documented.

**Status:** [ ] pending

---

### Sub-Task 3 — Docker Compose & Dockerfiles

**Intent:** One `docker-compose up` should bring up the full stack: API, background worker, frontend, TimescaleDB, and Redis. Live-capture vs pcap-replay is toggled via an environment variable.

**Expected Outcomes:**
- `docker-compose.yml` defines services: `db` (timescaledb), `redis`, `api`, `worker`, `frontend`
- `docker/Dockerfile.api` builds a slim Python image, installs requirements, runs uvicorn
- `docker/Dockerfile.worker` builds a Python image that runs the flow consumer
- `docker/Dockerfile.frontend` builds the React app and serves via nginx
- `.env.example` documents all required environment variables

**Todo List:**
1. Write `docker-compose.yml`:
   - `db`: `timescale/timescaledb-ha:pg16-latest`, persistent volume, exposes 5432
   - `redis`: `redis:7-alpine`, exposes 6379
   - `api`: builds from `docker/Dockerfile.api`, env_file `.env`, depends on `db` + `redis`, exposes 8000
   - `worker`: builds from `docker/Dockerfile.worker`, env_file `.env`, depends on `db` + `redis` + `api`
   - `frontend`: builds from `docker/Dockerfile.frontend`, exposes 3000, depends on `api`
   - Shared `ids-network` bridge network
2. Write `docker/Dockerfile.api` (multi-stage: builder installs deps, runtime copies wheels):
   - In the builder stage: `apt-get install -y libpcap-dev tshark` before pip installs, so Scapy and PyShark can compile/link correctly
   - Note: `tshark` pulls in `wireshark-common`; pin the apt package to avoid version drift
3. Write `docker/Dockerfile.worker` (single-stage Python slim):
   - Same system packages: `apt-get install -y libpcap-dev tshark` — the worker is the primary process that runs capture/replay
4. Write `docker/Dockerfile.frontend` (node:20-alpine build stage → nginx:alpine serve stage)
5. Write `.env.example` covering: `DATABASE_URL`, `REDIS_URL`, `CAPTURE_MODE` (live|replay), `PCAP_PATH`, `MODEL_ARTIFACTS_DIR`, `LOG_LEVEL`, `CORS_ORIGINS`

**Relevant Context:** `CAPTURE_MODE=replay` is the default for demo; `live` requires host network mode and NET_ADMIN capability, which should be noted as a comment in docker-compose.

**Status:** [ ] pending

---

### Sub-Task 4 — Database Layer (Models + Session)

**Intent:** Define the ORM models for `FlowRecord` and `Alert`, wire up the async SQLAlchemy session factory, and prepare the Alembic migration environment so the schema can be created with one command.

**Expected Outcomes:**
- `db/models.py` defines `FlowRecord` and `Alert` ORM classes
- `db/session.py` exports an async session factory and engine
- `db/migrations/env.py` is wired to the ORM metadata
- Schema notes TimescaleDB hypertable conversion in a comment (actual `create_hypertable` call goes in the first Alembic migration)

**Todo List:**
1. Write `db/session.py`:
   - Async SQLAlchemy engine from `DATABASE_URL` env var
   - `AsyncSession` factory
   - `get_db()` dependency for FastAPI
2. Write `db/models.py`:
   - `FlowRecord`: `id` (UUID PK), `timestamp` (DateTime, hypertable partition key), `src_ip`, `dst_ip`, `src_port`, `dst_port`, `protocol`, `features` (JSONB — raw flow feature dict)
   - `Alert`: `id` (UUID PK), `timestamp` (DateTime, hypertable partition key), `flow_id` (FK → FlowRecord), `stage` (int, 1 or 2), `attack_type` (str, nullable), `confidence` (float), `severity` (str: low/medium/high/critical), `reconstruction_error` (float, nullable for Stage 1), `shap_values` (JSONB), `raw_features` (JSONB)
3. Write `alembic.ini` at the project root — point `script_location = db/migrations`, `sqlalchemy.url` reads from env via `%(DATABASE_URL)s` interpolation
4. Write `db/migrations/env.py` wired to `Base.metadata` with async engine support (use `run_migrations_online` with `AsyncEngine`)
5. Add a comment block in `db/models.py` explaining the TimescaleDB hypertable conversion SQL that the first migration must run

**Relevant Context:** JSONB columns (`features`, `shap_values`, `raw_features`) use `sqlalchemy.dialects.postgresql.JSONB`. UUID primary keys use `sqlalchemy.dialects.postgresql.UUID`.

**Status:** [ ] pending

---

### Sub-Task 5 — FastAPI Application Skeleton

**Intent:** Build the complete FastAPI app with all routers, placeholder route handlers, Pydantic schemas, and WebSocket endpoints. Every route should return a structured stub response so the frontend can be developed against it immediately.

**Expected Outcomes:**
- `api/main.py` bootstraps the app with lifespan, CORS, and router registration
- All 4 routers (`ingestion`, `prediction`, `alerts`, `health`) have placeholder handlers returning typed stubs
- `ws.py` has two WebSocket endpoint stubs (`/ws/alerts`, `/ws/traffic`)
- `api/schemas/flow.py` and `api/schemas/alert.py` define all Pydantic v2 models
- OpenAPI docs are available at `/docs`

**Todo List:**
1. Write `api/schemas/flow.py`: `FlowFeatures` model (all 78 CICFlowMeter-style fields as `float`, with `src_ip`, `dst_ip`, `src_port`, `dst_port`, `protocol` metadata fields)
2. Write `api/schemas/alert.py`: `AlertOut` model, `AlertListResponse`, `SeverityEnum`
3. Write `api/dependencies.py`: `get_db` (re-exports from `db/session.py`), `get_redis` (returns Redis client from pool)
4. Write `api/routers/health.py`:
   - `GET /health` → `{"status": "ok", "version": "0.1.0"}`
   - `GET /health/ready` → checks DB + Redis connectivity, returns `{"db": bool, "redis": bool, "ready": bool}`
5. Write `api/routers/ingestion.py`:
   - `POST /ingest/flow` — accepts `FlowFeatures`, enqueues to Redis Stream `ids:flows`, returns `{"queued": true, "stream_id": str}`
   - `POST /ingest/pcap` — accepts multipart file upload of a pcap, enqueues replay job, returns `{"job_id": str, "status": "accepted"}`
6. Write `api/routers/prediction.py`:
   - `POST /predict` — accepts `FlowFeatures`, runs synchronous ML pipeline, returns `AlertOut`
   - `POST /predict/batch` — accepts `list[FlowFeatures]`, returns `list[AlertOut]`
7. Write `api/routers/alerts.py`:
   - `GET /alerts` — query params: `severity`, `attack_type`, `start_ts`, `end_ts`, `limit`, `offset`; returns `AlertListResponse`
   - `GET /alerts/{alert_id}` — returns single `AlertOut` with full SHAP detail
   - `DELETE /alerts/{alert_id}` — soft-delete, returns `{"deleted": true}`
8. Write `api/routers/ws.py`:
   - `WebSocket /ws/alerts` — streams new `AlertOut` JSON as they are written by the worker
   - `WebSocket /ws/traffic` — streams live flow summary stats (packets/sec, bytes/sec, top-N IPs)
9. Write `api/main.py`: app factory with `@asynccontextmanager` lifespan (init DB pool, Redis pool on startup; close on shutdown), register all routers with prefixes, add CORS middleware

**Relevant Context:** Use FastAPI `APIRouter` with `prefix` and `tags`. Pydantic v2 model syntax (`model_config`, `model_validator`). WebSocket connection manager pattern (a simple `ConnectionManager` class in `ws.py` with `connect`, `disconnect`, `broadcast`).

**Status:** [ ] pending

---

### Sub-Task 6 — ML Model Stubs

**Intent:** Create the three ML files (`classifier.py`, `anomaly_detector.py`, `explainer.py`) and the pipeline orchestrator (`pipeline.py`) as well-documented stubs. Each file must be importable, have clear class/function signatures, type hints, and TODO comments that guide a future implementer without any actual model logic.

**Expected Outcomes:**
- All four ML files are importable with no runtime errors
- Each class has `__init__`, `load`, `predict`/`detect`/`explain` method stubs with correct signatures and return type annotations
- TODO comments identify exactly what training data, hyperparameters, and thresholds need to be set
- `pipeline.py` wires Stage1 → Stage2 → SHAP with clear decision logic stubs

**Todo List:**
1. Write `ml/classifier.py` — `XGBoostClassifier` class:
   - `__init__(self, model_path: str)`: loads `.ubj` artifact; TODO: define label encoder
   - `load(self) -> None`: loads XGBoost booster from `model_path`; TODO: load sklearn LabelEncoder
   - `predict(self, features: np.ndarray) -> tuple[str, float]`: returns `(attack_type, confidence)`; TODO: call `booster.predict_proba`, apply threshold
   - Class-level `LABEL_MAP: dict[int, str]` stub with placeholder attack classes from CICIDS2017
2. Write `ml/anomaly_detector.py` — `AutoencoderDetector` class:
   - `__init__(self, model_path: str, threshold: float)`: TODO: threshold determined from training reconstruction error distribution (e.g. 95th percentile on normal traffic)
   - `load(self) -> None`: loads Keras `.keras` model
   - `detect(self, features: np.ndarray) -> tuple[bool, float]`: returns `(is_anomaly, reconstruction_error)`; TODO: scale input, forward pass, compute MSE, compare to threshold
3. Write `ml/explainer.py` — `SHAPExplainer` class:
   - `__init__(self, classifier: XGBoostClassifier)`: initialises `shap.TreeExplainer` on the XGBoost booster
   - `explain(self, features: np.ndarray) -> dict`: returns `{"feature_names": [...], "shap_values": [...], "base_value": float}`; TODO: call `explainer.shap_values`, zip with `feature_names.FEATURE_NAMES`
4. Write `ml/pipeline.py` — `DetectionPipeline` class:
   - `__init__(self)`: instantiates classifier, detector, explainer from env-var artifact paths
   - `run(self, features: np.ndarray) -> dict`: runs Stage1 → if confidence < threshold, escalates to Stage2 → runs SHAP → assembles and returns alert dict; TODO: define confidence escalation threshold (default 0.7)

**Relevant Context:** `feature_names.py` (Sub-Task 7) must exist before `explainer.py` can reference `FEATURE_NAMES`. ML stubs must import numpy and return typed stubs that match the `AlertOut` schema fields from Sub-Task 5.

**Status:** [ ] pending

---

### Sub-Task 7 — Ingestion & Feature Extraction Stubs

**Intent:** Stub the ingestion layer (capture/replay/producer) and feature extraction modules with correct interfaces, so the worker (Sub-Task 8) can import them and the real implementation can be dropped in later.

**Expected Outcomes:**
- `feature_extraction/feature_names.py` defines the canonical `FEATURE_NAMES` list (78 CICFlowMeter features)
- `ingestion/capture.py`, `replay.py`, `producer.py` are importable stubs with correct function signatures
- `feature_extraction/flow_builder.py` and `extractor.py` are importable stubs

**Todo List:**
1. Write `feature_extraction/feature_names.py`: define `FEATURE_NAMES: list[str]` — the exact 78 feature names from CICFlowMeter (e.g. `Flow Duration`, `Total Fwd Packets`, `Fwd Packet Length Max`, etc.). Add a TODO comment block after the list noting: "UNSW-NB15 uses different column names (e.g. `dur`, `proto`, `spkts`). If adding UNSW-NB15 support, define a separate UNSW_FEATURE_NAMES list and a mapping function to the canonical CICIDS2017 order."
2. Write `ingestion/capture.py`: `start_capture(interface: str, callback: Callable) -> None` stub; TODO: use Scapy `sniff()` or pyshark `LiveCapture`
3. Write `ingestion/replay.py`: `replay_pcap(pcap_path: str, callback: Callable, speed_multiplier: float = 1.0) -> None` stub; TODO: use Scapy `rdpcap()` + timing replay
4. Write `ingestion/producer.py`: `push_flow_to_stream(redis_client, flow_features: dict) -> str` stub; TODO: call `redis_client.xadd("ids:flows", flow_features)`, return stream entry ID
5. Write `feature_extraction/flow_builder.py`: `FlowBuilder` class stub with `add_packet(packet) -> None` and `get_completed_flows() -> list[dict]`; TODO: implement bidirectional flow tracking with timeout
6. Write `feature_extraction/extractor.py`: `extract_features(flow: dict) -> np.ndarray` stub; TODO: map flow dict keys to `FEATURE_NAMES` order, apply StandardScaler

**Relevant Context:** `FEATURE_NAMES` in `feature_names.py` is referenced by `ml/explainer.py`. The 78 features should match the CICIDS2017 dataset column names exactly to avoid mismatch at training time.

**Status:** [ ] pending

---

### Sub-Task 8 — Background Worker Stub

**Intent:** Stub the Redis Stream consumer worker that glues ingestion → feature extraction → ML pipeline → DB write → WebSocket broadcast. This is the real-time processing loop.

**Expected Outcomes:**
- `workers/flow_consumer.py` is a runnable async script that reads from `ids:flows` Redis Stream and calls through to the pipeline (stubs return dummy data for now)
- `workers/alert_broadcaster.py` is a stub that writes new alerts to the WebSocket connection manager

**Todo List:**
1. Write `workers/flow_consumer.py`:
   - Async main loop using `redis.xread` (consumer group pattern on stream `ids:flows`)
   - For each message: deserialise → call `extract_features()` → call `pipeline.run()` → write `Alert` to DB → push to broadcaster
   - TODO comments marking each step where real implementation replaces the stub call
   - Graceful shutdown on SIGTERM
2. Write `workers/alert_broadcaster.py`:
   - `broadcast_alert(alert: dict) -> None` async function
   - Imports and calls `ConnectionManager.broadcast()` from `api/routers/ws.py`
   - TODO: handle serialisation, add alert to Redis sorted set for fast "latest N alerts" queries

**Relevant Context:** The worker runs as a separate Docker service (`docker/Dockerfile.worker`). It must import from `ml/`, `feature_extraction/`, and `db/` — all Python paths must resolve correctly (use a top-level `PYTHONPATH` or install as a package).

**Status:** [ ] pending

---

### Sub-Task 9 — Frontend Scaffold (React + TypeScript)

**Intent:** Initialise the React TypeScript project with the correct folder structure, install dependencies (Recharts, axios, WebSocket hooks), and create stub components for the three main dashboard panels. No real data wiring yet — just the component tree and type definitions.

**Expected Outcomes:**
- `frontend/` is a valid Vite + React + TypeScript project (`npm install` works)
- `package.json` includes `recharts`, `axios`, `react-router-dom`
- Stub components exist for `TrafficFeed`, `AlertPanel`, `SeverityGauge`
- `hooks/useWebSocket.ts` and `hooks/useAlerts.ts` stubs exist with correct TypeScript interfaces
- `api/client.ts` sets up axios base URL from env var

**Todo List:**
1. Write `frontend/package.json` with Vite, React 18, TypeScript, Recharts, axios, react-router-dom
2. Write `frontend/tsconfig.json` (strict mode, ESNext target)
3. Write `frontend/vite.config.ts` with proxy to `http://api:8000` for `/api` and `/ws`
4. Write `frontend/src/main.tsx` entry point
5. Write `frontend/src/api/client.ts`: axios instance with `baseURL` from `VITE_API_URL` env var
6. Write `frontend/src/hooks/useWebSocket.ts`: generic WebSocket hook returning `{ lastMessage, readyState }`
7. Write `frontend/src/hooks/useAlerts.ts`: uses `useWebSocket` on `/ws/alerts`, maintains `Alert[]` state
8. Write `frontend/src/components/TrafficFeed.tsx`: stub table of recent flow records
9. Write `frontend/src/components/AlertPanel.tsx`: stub list of recent alerts with severity badges
10. Write `frontend/src/components/SeverityGauge.tsx`: stub Recharts `RadialBarChart` showing severity distribution
11. Write `frontend/src/pages/Dashboard.tsx`: composes the three stub components

**Relevant Context:** Vite proxy configuration is critical so the frontend container can reach the API container by service name (`api`) inside the Docker network. `VITE_API_URL` defaults to `http://localhost:8000` for local dev outside Docker.

**Status:** [ ] pending

---

### Sub-Task 10 — Integration Smoke Test & README

**Intent:** Verify the scaffold is internally consistent (all imports resolve, FastAPI app starts, Docker Compose validates) and write a comprehensive README so the project is immediately presentable.

**Expected Outcomes:**
- `README.md` documents: architecture diagram (text/ASCII), quick-start commands, environment variables table, API endpoint reference, ML pipeline description, roadmap (Watson integration)
- All Python imports in the stub files are self-consistent (no circular imports, no missing modules)
- `docker-compose config` (YAML validation) would pass

**Todo List:**
1. Audit all `import` statements across stubs for consistency — fix any that reference modules not yet created
2. Update `README.md` with:
   - ASCII architecture diagram showing: Ingestion → Redis Stream → Worker → ML Pipeline → PostgreSQL + WebSocket → React Dashboard
   - Quick-start: `cp .env.example .env && docker-compose up --build`
   - Environment variables table
   - API endpoints table (path, method, description)
   - ML pipeline section (Stage 1 XGBoost, Stage 2 Autoencoder, SHAP)
   - Watson integration roadmap section (placeholder)
3. Add a `PYTHONPATH` note to `docker/Dockerfile.api` and `docker/Dockerfile.worker` ensuring project root is on the path

**Relevant Context:** This sub-task is a review pass, not new feature work. It should catch any stub that imports a symbol not yet defined.

**Status:** [ ] pending

---

### Sub-Task 11 — Training Script Stubs (scripts/)

**Intent:** Create the `scripts/` directory with two well-commented stub files so the training phase has a clear starting point. No training logic is implemented — only the structure, argument parsing scaffolding, and TODO headers.

**Expected Outcomes:**
- `scripts/train_classifier.py` is a runnable Python script with argparse, imports, and TODO-marked training steps
- `scripts/train_autoencoder.py` is a runnable Python script with the same structure for the Keras autoencoder
- Both scripts print a clear "not yet implemented" message when run without any flags

**Todo List:**
1. Write `scripts/train_classifier.py`:
   - Argparse: `--data-path`, `--output-dir`, `--n-estimators`, `--max-depth`, `--test-split`
   - Import block: `xgboost`, `pandas`, `sklearn`, `shap`, `joblib`
   - TODO sections (each clearly marked):
     - Load and preprocess CICIDS2017 CSV (drop NaN, encode labels)
     - Train/test split
     - `XGBClassifier.fit()` call
     - Evaluate (classification report, confusion matrix)
     - Save model with `booster.save_model(output_dir/classifier.ubj)` and LabelEncoder with `joblib`
     - Run SHAP summary plot on test set
2. Write `scripts/train_autoencoder.py`:
   - Argparse: `--data-path`, `--output-dir`, `--epochs`, `--batch-size`, `--threshold-percentile`
   - Import block: `tensorflow.keras`, `numpy`, `pandas`, `sklearn`, `joblib`
   - TODO sections:
     - Load CICIDS2017 BENIGN-only rows (normal traffic filter)
     - StandardScaler fit on training data, save scaler with `joblib`
     - Define encoder/decoder architecture (Dense layers, bottleneck)
     - `model.fit()` call
     - Compute reconstruction errors on validation set, set threshold at Nth percentile
     - Save model with `model.save(output_dir/autoencoder.keras)` and threshold to a JSON file

**Relevant Context:** These scripts run outside Docker (or in a training container) and import from `ml/` and `feature_extraction/` — `PYTHONPATH` must include the project root. The `scripts/` directory has no `__init__.py`.

**Status:** [ ] pending

---

## Implementation Order

```
Sub-Task 1  (skeleton — includes scripts/ dir)
    ↓
Sub-Task 2  (dependencies)        Sub-Task 3  (Docker — libpcap/tshark in api + worker)
    ↓                                  ↓
Sub-Task 4  (DB layer)
    ↓
Sub-Task 7  (ingestion + feature stubs, UNSW TODO in feature_names)   Sub-Task 5  (FastAPI skeleton)
    ↓                                                                       ↓
Sub-Task 6  (ML stubs — needs feature_names from Task 7 and schemas from Task 5)
    ↓
Sub-Task 8  (worker — needs ML pipeline + DB + API ws manager)
    ↓
Sub-Task 9  (frontend scaffold)       Sub-Task 11  (training script stubs)
    ↓                                      ↓
Sub-Task 10 (smoke test + README — audits all stubs including scripts/)
```

---

## Open Questions / Future Work

- **Watson integration:** `POST /watson/summarise` and `POST /watson/respond` routes are reserved but not scaffolded here. These will call `ibm-watsonx-ai` SDK and Watson Orchestrate REST API respectively.
- **Dataset download:** CICIDS2017 and UNSW-NB15 download/preprocessing scripts are out of scope here; training scripts assume pre-downloaded CSV files at a user-supplied `--data-path`.
- **Authentication:** No auth on API endpoints in this scaffold. JWT middleware is a follow-up task.
- **Live capture in Docker:** Requires `network_mode: host` and `cap_add: NET_ADMIN` — documented in `.env.example` and docker-compose comments but not enabled by default.
- **UNSW-NB15 support:** Flagged in `feature_extraction/feature_names.py` as a TODO. Requires a separate feature name list and mapping function before training scripts can be reused for that dataset.
