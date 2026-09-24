# 🚀 Deployment Guide: SIH26189 Criminal Network Analysis System

This document provides step-by-step instructions for deploying the **Ministry of Home Affairs // Criminal Network Analysis System** to production.

---

## 🏗️ Architecture Overview

| Component | Technology | Recommended Host |
| :--- | :--- | :--- |
| **Frontend UI** | Next.js 15 (App Router, Tailwind CSS v4, Cytoscape.js) | [Vercel](https://vercel.com) / Netlify / Docker |
| **Backend API** | FastAPI, Uvicorn, Python 3.11, Groq LLM Client | [Render](https://render.com) / [Railway](https://railway.app) / Fly.io / Docker |
| **Graph Database** | Neo4j Graph Database | [Neo4j AuraDB (Cloud Free/Enterprise)](https://neo4j.com/cloud/platform/aura-graph-database/) |
| **AI LLM Inference** | Groq Cloud (`llama3-8b-8192`) | [Groq Console](https://console.groq.com) |

---

## 📋 Required Environment Variables

### 1. Backend Environment Variables (`backend/.env`)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NEO4J_URI` | Neo4j connection URI (bolt or neo4j+s) | `neo4j+s://4253ba54.databases.neo4j.io` |
| `NEO4J_USERNAME` | Neo4j database user | `neo4j` |
| `NEO4J_PASSWORD` | Neo4j database password | `YourStrongPassword` |
| `GROQ_API_KEY` | Groq API Key for extraction & copilot | `gsk_...` |
| `APP_NAME` | Display name for system | `Criminal Network Analysis System (SIH26189)` |
| `DEBUG` | Debug mode toggle | `False` |

### 2. Frontend Environment Variables (`frontend/.env.local`)

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Public URL of the FastAPI backend | `https://sih26189-api.onrender.com` |

---

## 🌐 Option 1: Cloud Deployment (Vercel + Render + Neo4j Aura) — Recommended

### Step 1: Deploy Database (Neo4j AuraDB)
1. Sign up at [Neo4j Aura](https://neo4j.com/cloud/platform/aura-graph-database/).
2. Create a Free **AuraDB Instance**.
3. Download the generated credentials text file (`NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`).

### Step 2: Deploy Backend to Render / Railway
1. Push your Git repository to GitHub / GitLab.
2. In [Render.com](https://render.com), click **New Web Service** and connect your repository.
3. Configure settings:
   - **Root Directory:** `backend`
   - **Environment:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2`
4. Add the following **Environment Variables** in the Render Dashboard:
   - `NEO4J_URI`: `neo4j+s://your-instance.databases.neo4j.io`
   - `NEO4J_USERNAME`: `neo4j`
   - `NEO4J_PASSWORD`: `your-password`
   - `GROQ_API_KEY`: `your-groq-key`
5. Click **Deploy**. Note down your backend URL (e.g., `https://sih26189-backend.onrender.com`).

### Step 3: Deploy Frontend to Vercel
1. In [Vercel](https://vercel.com), click **Add New Project** and import your repository.
2. Configure settings:
   - **Framework Preset:** `Next.js`
   - **Root Directory:** `frontend`
3. Add **Environment Variable**:
   - `NEXT_PUBLIC_API_URL`: `https://sih26189-backend.onrender.com` *(your Render backend URL)*
4. Click **Deploy**.

---

## 🐳 Option 2: Single-Server / VPS Deployment (Docker Compose)

For deploying on an AWS EC2 instance, GCP VM, DigitalOcean Droplet, or local on-premise server:

### 1. Clone Repository & Setup Secrets
```bash
git clone <your-repo-url>
cd SIH26189

# Create backend .env
cp backend/.env.example backend/.env
# Edit with your actual Neo4j and Groq keys
nano backend/.env
```

### 2. Run with Docker Compose
```bash
# Build and run containers in background
docker compose up -d --build

# Verify container status
docker compose ps

# View backend logs
docker compose logs -f backend
```

Your system will be available at:
- **Frontend Dashboard:** `http://<your-server-ip>:3000`
- **Backend API & Swagger Docs:** `http://<your-server-ip>:8000/docs`

---

## 🛡️ Pre-Deployment Verification Checklist

- [x] **Root `.gitignore`** configured to prevent committing `.env`, `node_modules`, `venv`, and build artifacts.
- [x] **Dynamic Frontend API Endpoint:** `NEXT_PUBLIC_API_URL` environment variable properly configured with fallback to `http://localhost:8000`.
- [x] **Standalone Next.js Configuration:** Configured in `next.config.ts` for minimal production bundle footprint.
- [x] **CORS:** FastAPI CORS allows communication from deployed frontend domains.
- [x] **Health Check:** `GET /` endpoint returns live status for load balancers.
- [x] **Purge Mechanism:** `DELETE /api/v1/admin/clear-db` ready for clean demo presentations.

---

## 🔍 Health & Sanity Tests

After deploying, verify the deployment by running:

```bash
# Test backend health
curl https://your-backend-domain.com/

# Test Cytoscape topology route
curl https://your-backend-domain.com/api/v1/graph/topology

# Test smurfing alerts route
curl https://your-backend-domain.com/api/v1/intelligence/smurfing-alerts
```
