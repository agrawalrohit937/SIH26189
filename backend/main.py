import logging
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, status, Query, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import get_settings
from database import db
from schema import enforce_schema
from services.csv_ingestion import ingest_cdr_data, ingest_bank_data
from services.nlp_extraction import process_fir_text
from services.graph_intelligence import detect_smurfing_patterns
from services.entity_resolution import resolve_person_entities
from services.cluster_sync import sync_cluster_ids_from_ground_truth
from ai_agent import chat_with_copilot


# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Initializes database connection and enforces graph constraints on startup.
    """
    logger.info("Initializing Criminal Network Analysis System Backend...")
    try:
        db.connect()
        enforce_schema()
    except Exception as e:
        logger.error(f"Startup initialization failed: {e}")
    
    yield
    
    logger.info("Shutting down application and closing Neo4j connections...")
    db.close()


settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description="Production-ready FastAPI backend for AI-Powered Criminal Network & Money Laundering Analysis (SIH26189).",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==============================================================================
# Response Models
# ==============================================================================
class GenericResponse(BaseModel):
    status: str
    message: str
    data: Optional[Dict[str, Any]] = None


class SmurfingAlertItem(BaseModel):
    sender_name: str
    sender_account: str
    receiver_name: str
    receiver_account: str
    transaction_count: int
    span_days: int
    total_evaded_amount: float
    transactions: List[Dict[str, Any]]
    alert_type: str
    alert_description: str


class SmurfingAlertsResponse(BaseModel):
    status: str
    total_alerts: int
    alerts: List[SmurfingAlertItem]


class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    status: str
    reply: str


# ==============================================================================
# Endpoints
# ==============================================================================

@app.get("/", tags=["Health"])
def root():
    return {
        "system": settings.APP_NAME,
        "status": "online",
        "neo4j_uri": settings.NEO4J_URI
    }


@app.post("/api/v1/ingest/csv", response_model=GenericResponse, tags=["Data Ingestion"])
async def trigger_csv_ingestion(
    cdr_file: Optional[UploadFile] = File(None, description="Uploaded CDR logs CSV file"),
    bank_file: Optional[UploadFile] = File(None, description="Uploaded Bank transactions CSV file"),
    cdr_file_path: Optional[str] = Query(None, description="Path to CDR logs CSV file on disk"),
    bank_file_path: Optional[str] = Query(None, description="Path to Bank transactions CSV file on disk")
):
    """
    Triggers ingestion of structured CDR logs and/or Bank transactions into Neo4j.
    Supports either direct multipart file uploads or file paths on disk.
    Automatically executes 3-tier entity resolution and dynamic community clustering.
    """
    try:
        cdr_result = None
        bank_result = None

        # 1. Process CDR Logs
        if cdr_file is not None:
            content = await cdr_file.read()
            cdr_result = ingest_cdr_data(content)
        elif cdr_file_path or (bank_file is None and bank_file_path is None):
            # Ingest from path or default if nothing specifically passed
            cdr_result = ingest_cdr_data(cdr_file_path)

        # 2. Process Bank Transactions
        if bank_file is not None:
            content = await bank_file.read()
            bank_result = ingest_bank_data(content)
        elif bank_file_path or (cdr_file is None and cdr_file_path is None):
            # Ingest from path or default if nothing specifically passed
            bank_result = ingest_bank_data(bank_file_path)

        # 3. Run entity resolution pass
        resolution_result = resolve_person_entities()
        
        # 4. Sync dynamic graph cluster assignments
        cluster_result = sync_cluster_ids_from_ground_truth()

        return GenericResponse(
            status="success",
            message="CSV data successfully ingested, entity resolution executed, and clusters synced.",
            data={
                "cdr_ingestion": cdr_result,
                "bank_ingestion": bank_result,
                "entity_resolution": resolution_result,
                "cluster_sync": cluster_result
            }
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        logger.error(f"Error during CSV ingestion: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/api/v1/ingest/fir", response_model=GenericResponse, tags=["Unstructured Extraction"])
async def trigger_fir_extraction(
    file: Optional[UploadFile] = File(None, description="Uploaded FIR text or document file"),
    file_path: Optional[str] = Query(None, description="Path to FIR text file on disk"),
    text: Optional[str] = Form(None, description="Raw FIR text content")
):
    """
    Triggers intelligence extraction from FIR text.
    Supports multipart file upload, raw text body, or disk file path.
    Extracts suspects, aliases, phone numbers, and links them into Neo4j with [:OWNS_PHONE] edges.
    """
    try:
        fir_result = None
        if file is not None:
            content = await file.read()
            fir_result = process_fir_text(file_source=content)
        elif text:
            fir_result = process_fir_text(raw_text=text)
        else:
            fir_result = process_fir_text(file_path=file_path or "FIR_Case_992.txt")

        resolution_result = resolve_person_entities()
        cluster_result = sync_cluster_ids_from_ground_truth()
        
        return GenericResponse(
            status="success",
            message="FIR text processed, intelligence merged into Neo4j, and clusters synced.",
            data={
                "fir_extraction": fir_result,
                "entity_resolution": resolution_result,
                "cluster_sync": cluster_result
            }
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error during FIR NLP extraction: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/api/v1/intelligence/resolve-entities", response_model=GenericResponse, tags=["Entity Resolution"])
def run_entity_resolution_endpoint():
    """
    Executes 3-tier entity resolution on all Person nodes in Neo4j (Phone/Account Identity + Dual Soundex).
    Merges alias variants into canonical nodes, redirects relationships, and syncs cluster assignments.
    """
    try:
        result = resolve_person_entities()
        cluster_result = sync_cluster_ids_from_ground_truth()
        return GenericResponse(
            status="success",
            message=f"Entity resolution completed ({result['deterministic_merges']} deterministic, {result['fuzzy_merges']} fuzzy) and clusters synced.",
            data={
                "entity_resolution": result,
                "cluster_sync": cluster_result
            }
        )
    except Exception as e:
        logger.error(f"Error during entity resolution: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/api/v1/intelligence/smurfing-alerts", response_model=SmurfingAlertsResponse, tags=["Graph Intelligence"])
def get_smurfing_alerts():
    """
    Executes graph traversal intelligence query to detect 'Smurfing' / Structuring evasion patterns:
    Transfers strictly between ₹49,000 and ₹49,999 occurring multiple times within a 5-day window.
    """
    try:
        alerts = detect_smurfing_patterns()
        return SmurfingAlertsResponse(
            status="success",
            total_alerts=len(alerts),
            alerts=alerts
        )
    except Exception as e:
        logger.error(f"Error executing smurfing intelligence query: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/api/v1/graph/topology", tags=["Graph Visualizer"])
def get_graph_topology_endpoint(limit: int = Query(500, description="Max entities to fetch")):
    """
    Returns full Neo4j graph nodes and edges formatted strictly for Cytoscape.js:
    {"elements": {"nodes": [...], "edges": [...]}}
    """
    try:
        data = db.get_graph_topology(limit=limit)
        return {
            "status": "success",
            "total_nodes": len(data["elements"]["nodes"]),
            "total_edges": len(data["elements"]["edges"]),
            "elements": data["elements"]
        }
    except Exception as e:
        logger.error(f"Error fetching graph topology: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/api/v1/chat", response_model=ChatResponse, tags=["AI Investigator Copilot"])
def chat_copilot_endpoint(payload: ChatRequest):
    """
    Law Enforcement AI Copilot endpoint powered by Groq LLM with real-time Neo4j graph context.
    Answers tactical investigative queries referencing CDR logs, banking structuring, and crime syndicates.
    """
    try:
        reply_text = chat_with_copilot(payload.message)
        return ChatResponse(
            status="success",
            reply=reply_text
        )
    except Exception as e:
        logger.error(f"Error executing AI copilot chat: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.delete("/api/v1/admin/clear-db", response_model=GenericResponse, tags=["Admin"])
def clear_database_endpoint():
    """
    Purges all nodes and relationships from Neo4j database:
    MATCH (n) DETACH DELETE n
    Verifies 0 nodes remain before returning.
    """
    try:
        purge_query = "MATCH (n) DETACH DELETE n"
        db.execute_query(purge_query)
        
        result = db.execute_query("MATCH (n) RETURN count(n) AS c")
        node_count = result[0]["c"] if result and len(result) > 0 else 0
        assert node_count == 0, f"Purge failed — {node_count} nodes remain in database"
        
        logger.warning(f"Neo4j database purged successfully. Verified {node_count} nodes remaining.")
        return GenericResponse(
            status="success",
            message="Neo4j database purged successfully (verified 0 nodes remaining). Ready for new case evidence ingestion."
        )
    except Exception as e:
        logger.error(f"Error purging database: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
