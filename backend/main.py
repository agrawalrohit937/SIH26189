import logging
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, HTTPException, status, Query, File, UploadFile, Form, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from config import get_settings
from database import db
from schema import enforce_schema
from services.csv_ingestion import ingest_cdr_data, ingest_bank_data
from services.nlp_extraction import process_fir_text
from services.graph_intelligence import detect_smurfing_patterns
from services.entity_resolution import resolve_person_entities
from services.cluster_sync import sync_cluster_ids_from_ground_truth
from services.audit_trail import log_action, verify_audit_chain, get_recent_audit_logs
from services.auth import get_current_user, require_admin, DEMO_USERS, create_access_token, mask_pii_if_investigator
from services.gat_link_prediction import compute_gat_predicted_links, record_active_learning_feedback
from services.evasion_detection import detect_burner_chains
from services.geo_intelligence import get_geo_intelligence_overlay
from services.ocr_ingestion import extract_text_from_pdf, extract_text_from_image
from services.briefing_generator import generate_officer_briefing
from services.document_rag import clear_document_store
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
    Initializes database connection, enforces graph constraints, and logs system startup.
    """
    logger.info("Initializing Criminal Network Analysis System Backend...")
    try:
        db.connect()
        enforce_schema()
        log_action("System Core", "SYSTEM_STARTUP", "FastAPI intelligence backend initialized with Neo4j schema enforcement.")
    except Exception as e:
        logger.error(f"Startup initialization failed: {e}")
    
    yield
    
    logger.info("Shutting down application and closing Neo4j connections...")
    log_action("System Core", "SYSTEM_SHUTDOWN", "FastAPI intelligence backend gracefully shutting down.")
    db.close()


settings = get_settings()
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])

app = FastAPI(
    title=settings.APP_NAME,
    description="Production-ready FastAPI backend for AI-Powered Criminal Network & Money Laundering Analysis (SIH26189). Features tamper-evident hash-chained blockchain audit trail, demo-configurable structuring detection, and GAT link prediction.",
    version="1.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

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


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    status: str
    access_token: str
    token_type: str = "bearer"
    user: Dict[str, Any]


class ChatRequest(BaseModel):
    message: str


class BriefingRequest(BaseModel):
    entity_name: str
    case_id: Optional[str] = None


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


class AuditVerificationResponse(BaseModel):
    status: str
    chain_intact: bool
    total_entries: int
    genesis_prev_hash: Optional[str] = None
    latest_hash: Optional[str] = None
    tamper_detected: bool
    tamper_index: Optional[int] = None
    message: str


# ==============================================================================
# Endpoints
# ==============================================================================

@app.get("/", tags=["Health"])
def root():
    return {
        "system": settings.APP_NAME,
        "status": "online",
        "neo4j_uri": settings.NEO4J_URI,
        "audit_trail": "tamper_evident_sha256_chained",
        "rbac_enabled": True
    }


@app.post("/api/v1/auth/login", response_model=LoginResponse, tags=["Authentication & RBAC"])
def login_endpoint(payload: LoginRequest):
    """
    Authenticates investigator, supervisor, or admin demo users.
    Returns signed JWT-compatible token with role-based claims.
    """
    user_record = DEMO_USERS.get(payload.username.lower())
    if not user_record or user_record["password"] != payload.password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Available demo logins: investigator/investigator123, supervisor/supervisor123, admin/admin123"
        )
    token = create_access_token(user_record["username"], user_record["role"])
    log_action(
        actor=f"{user_record['role']}: {user_record['username']}",
        action_type="USER_LOGIN",
        action_detail=f"User '{user_record['username']}' authenticated with role '{user_record['role']}'."
    )
    return LoginResponse(
        status="success",
        access_token=token,
        token_type="bearer",
        user={
            "username": user_record["username"],
            "role": user_record["role"],
            "full_name": user_record["full_name"]
        }
    )


@app.get("/api/v1/auth/me", tags=["Authentication & RBAC"])
def get_current_user_profile(user: Dict[str, Any] = Depends(get_current_user)):
    """Returns current active user session and RBAC role."""
    return {
        "status": "success",
        "user": user
    }


@app.post("/api/v1/chat", tags=["AI Copilot"])
@app.post("/api/v1/copilot/chat", tags=["AI Copilot"])
@limiter.limit("30/minute")
def chat_copilot_endpoint(request: Request, payload: ChatRequest):
    """
    Direct endpoint for AI Investigator's Co-Pilot.
    Executes tiered Groq inference with strict tool dispatch, grounded graph Cypher, and RAG document citations.
    """
    try:
        reply = chat_with_copilot(payload.message)
        log_action(
            actor="Investigating Officer",
            action_type="COPILOT_CHAT",
            action_detail=f"Queried Copilot: '{payload.message[:80]}...'"
        )
        return {
            "status": "success",
            "reply": reply
        }
    except Exception as e:
        logger.error(f"Error handling Copilot chat: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/api/v1/intelligence/generate-briefing", tags=["Graph Intelligence"])
def generate_briefing_endpoint(payload: BriefingRequest):
    """
    Synthesizes graph connectivity, structured evasion alerts, and ingested FIR paragraphs
    into a formal, officer-ready intelligence dossier with strict citation discipline.
    """
    try:
        briefing = generate_officer_briefing(payload.entity_name, payload.case_id)
        log_action(
            actor="Investigating Officer",
            action_type="GENERATE_BRIEFING",
            action_detail=f"Generated formal intelligence briefing dossier for '{payload.entity_name}'."
        )
        return briefing
    except Exception as e:
        logger.error(f"Error generating intelligence briefing: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/api/v1/ingest/csv", response_model=GenericResponse, tags=["Data Ingestion"])
@limiter.limit("30/minute")
async def trigger_csv_ingestion(
    request: Request,
    cdr_file: Optional[UploadFile] = File(None, description="Uploaded CDR logs CSV file"),
    bank_file: Optional[UploadFile] = File(None, description="Uploaded Bank transactions CSV file"),
    cdr_file_path: Optional[str] = Query(None, description="Path to CDR logs CSV file on disk"),
    bank_file_path: Optional[str] = Query(None, description="Path to Bank transactions CSV file on disk"),
    case_id: Optional[str] = Form("FIR-992/2026", description="Case docket or FIR number")
):
    """
    Triggers ingestion of structured CDR logs and/or Bank transactions into Neo4j.
    Supports either direct multipart file uploads or file paths on disk.
    Automatically executes 3-tier entity resolution and dynamic community clustering.
    Logs tamper-evident audit record upon completion.
    """
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

    try:
        cdr_result = None
        bank_result = None
        active_case = str(case_id or "FIR-992/2026").strip()

        if cdr_file is None and bank_file is None and not cdr_file_path and not bank_file_path:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No CSV file provided. Please select and upload a Banking Ledger CSV or Telecom CDR Logs CSV."
            )

        # 1. Process CDR Logs
        if cdr_file is not None:
            content = await cdr_file.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded CDR file exceeds maximum allowed size (10 MB).")
            cdr_result = ingest_cdr_data(content, case_id=active_case)
        elif cdr_file_path:
            cdr_result = ingest_cdr_data(cdr_file_path, case_id=active_case)

        # 2. Process Bank Transactions
        if bank_file is not None:
            content = await bank_file.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded Bank file exceeds maximum allowed size (10 MB).")
            bank_result = ingest_bank_data(content, case_id=active_case)
        elif bank_file_path:
            bank_result = ingest_bank_data(bank_file_path, case_id=active_case)

        # 3. Run entity resolution pass
        resolution_result = resolve_person_entities()
        
        # 4. Sync dynamic graph cluster assignments
        cluster_result = sync_cluster_ids_from_ground_truth()

        log_action(
            actor="Investigating Officer",
            action_type="INGEST_CSV_DATA",
            action_detail=f"Ingested evidence into Case '{active_case}': CDR={bool(cdr_result)}, Bank={bool(bank_result)}. Aliases unified={resolution_result.get('aliases_unified', 0)}."
        )

        return GenericResponse(
            status="success",
            message=f"CSV data successfully ingested for Case '{active_case}', entity resolution executed, and clusters synced.",
            data={
                "case_id": active_case,
                "cdr_ingestion": cdr_result,
                "bank_ingestion": bank_result,
                "entity_resolution": resolution_result,
                "cluster_sync": cluster_result
            }
        )
    except ValueError as e:
        logger.warning(f"Validation error during CSV ingestion: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error during CSV ingestion: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/api/v1/ingest/fir", response_model=GenericResponse, tags=["Unstructured Extraction"])
@limiter.limit("30/minute")
async def trigger_fir_extraction(
    request: Request,
    file: Optional[UploadFile] = File(None, description="Uploaded FIR text, PDF, or image file"),
    file_path: Optional[str] = Query(None, description="Path to FIR file on disk"),
    text: Optional[str] = Form(None, description="Raw FIR text content"),
    case_id: Optional[str] = Form(None, description="Optional Case ID or FIR docket override")
):
    """
    Triggers intelligence extraction from FIR text, PDF documents, or scanned images.
    Supports multipart file upload (TXT, PDF, PNG, JPG), raw text body, or disk file path.
    Extracts suspects, aliases, phone numbers, and links them into Neo4j with [:OWNS_PHONE] edges.
    Logs tamper-evident audit record.
    """
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

    if file is None and not file_path and not text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No FIR docket provided. Please select and upload a Case Docket (PDF/TXT/Image) or provide text."
        )

    try:
        fir_result = None
        if file is not None:
            content = await file.read()
            if len(content) > MAX_FILE_SIZE:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file exceeds maximum allowed size (10 MB).")

            filename = (file.filename or "").lower()
            content_type = (file.content_type or "").lower()

            if filename.endswith(".pdf") or "pdf" in content_type:
                extracted_text = extract_text_from_pdf(content)
                if not extracted_text:
                    raise ValueError("Could not extract any readable text from uploaded PDF document.")
                fir_result = process_fir_text(raw_text=extracted_text, case_id=case_id)
            elif filename.endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp")) or "image" in content_type:
                extracted_text = extract_text_from_image(content)
                if not extracted_text:
                    raise ValueError("Could not extract any readable text from uploaded image.")
                fir_result = process_fir_text(raw_text=extracted_text, case_id=case_id)
            else:
                text_content = content.decode('utf-8', errors='replace')
                fir_result = process_fir_text(raw_text=text_content, case_id=case_id)
        elif text:
            fir_result = process_fir_text(raw_text=text, case_id=case_id)
        else:
            fir_result = process_fir_text(file_path=file_path or "FIR_Case_992.txt", case_id=case_id)

        resolution_result = resolve_person_entities()
        cluster_result = sync_cluster_ids_from_ground_truth()
        
        assigned_case = fir_result.get("case_id", "FIR-992/2026") if fir_result else "FIR-992/2026"
        log_action(
            actor="Investigating Officer",
            action_type="INGEST_FIR_DOCKET",
            action_detail=f"Processed FIR Docket '{assigned_case}': Suspects extracted={fir_result.get('total_persons_extracted', 0) if fir_result else 0}."
        )

        return GenericResponse(
            status="success",
            message=f"FIR document for Case '{assigned_case}' processed, intelligence merged into Neo4j, and clusters synced.",
            data={
                "case_id": assigned_case,
                "fir_extraction": fir_result,
                "entity_resolution": resolution_result,
                "cluster_sync": cluster_result
            }
        )
    except FileNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except ValueError as e:
        logger.warning(f"Validation error during FIR extraction: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except HTTPException:
        raise
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
        
        log_action(
            actor="Intelligence Engine",
            action_type="RESOLVE_ENTITIES",
            action_detail=f"Resolved entities: {result['deterministic_merges']} deterministic, {result['fuzzy_merges']} fuzzy, {result['aliases_unified']} unified."
        )

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


class FeedbackRequest(BaseModel):
    predicted_link_id: str
    decision: str  # "confirm" | "reject"


@app.get("/api/v1/intelligence/predicted-links", tags=["Graph Intelligence"])
def get_predicted_links_endpoint(
    confidence_threshold: float = Query(0.50, description="Minimum confidence score (0.0 to 1.0)"),
    top_k: int = Query(10, description="Max predicted links to return"),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Executes a 2-Layer Graph Attention Network (GAT) link prediction model over the active Neo4j topology.
    Returns unobserved links ranked by dot-product sigmoid confidence with attention-weighted plain-language justifications.
    Flags any prediction with confidence < 0.70 with requires_human_verification: true.
    """
    try:
        result = compute_gat_predicted_links(confidence_threshold=confidence_threshold, top_k=top_k)
        log_action(
            actor=user.get("actor", "Intelligence Engine"),
            action_type="GAT_LINK_PREDICTION",
            action_detail=f"Computed GAT link prediction: {result['total_predictions']} candidate link(s) identified."
        )
        return result
    except Exception as e:
        logger.error(f"Error computing GAT link predictions: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.post("/api/v1/intelligence/feedback", tags=["Active Learning"])
def submit_link_feedback_endpoint(
    payload: FeedbackRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Submits human investigator feedback ('confirm' or 'reject') for active learning.
    Persists decision and immediately incorporates it into subsequent GAT retraining passes.
    """
    try:
        if payload.decision.lower() not in ["confirm", "reject"]:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Decision must be 'confirm' or 'reject'")
        
        result = record_active_learning_feedback(payload.predicted_link_id, payload.decision.lower())
        log_action(
            actor=user.get("actor", "Investigating Officer"),
            action_type="ACTIVE_LEARNING_FEEDBACK",
            action_detail=f"Recorded '{payload.decision.lower()}' feedback for {payload.predicted_link_id}."
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting active learning feedback: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/api/v1/alerts/evasion", tags=["Graph Intelligence"])
def get_evasion_alerts_endpoint(
    min_phones: int = Query(4, description="Minimum distinct phone numbers linked to person"),
    max_window_days: int = Query(30, description="Maximum activation temporal window in days"),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Detects SIM-swap velocity and Burner Number Cycling evasion patterns:
    Flags Persons linked to multiple phone numbers activated within a tight temporal window.
    """
    try:
        alerts = detect_burner_chains(min_phones=min_phones, max_window_days=max_window_days)
        log_action(
            actor=user.get("actor", "Intelligence Engine"),
            action_type="SCAN_EVASION_ALERTS",
            action_detail=f"Scanned burner chain evasion patterns. Found {len(alerts)} alert pattern(s)."
        )
        return {
            "status": "success",
            "total_alerts": len(alerts),
            "alerts": alerts
        }
    except Exception as e:
        logger.error(f"Error executing evasion intelligence query: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))



@app.get("/api/v1/intelligence/smurfing-alerts", response_model=SmurfingAlertsResponse, tags=["Graph Intelligence"])
@app.get("/api/v1/alerts/financial", response_model=SmurfingAlertsResponse, tags=["Graph Intelligence"])
def get_smurfing_alerts():
    """
    Executes graph traversal intelligence query to detect 'Smurfing' / Structuring evasion patterns:
    Transfers structured in the demo-configurable range (₹49,000–₹49,999) occurring multiple times within a 5-day window,
    matching known financial structuring evasion patterns.
    """
    try:
        alerts = detect_smurfing_patterns()
        log_action(
            actor="Intelligence Engine",
            action_type="SCAN_SMURFING_ALERTS",
            action_detail=f"Scanned structuring patterns. Found {len(alerts)} alert pattern(s)."
        )
        return SmurfingAlertsResponse(
            status="success",
            total_alerts=len(alerts),
            alerts=alerts
        )
    except Exception as e:
        logger.error(f"Error executing smurfing intelligence query: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/api/v1/graph/topology", tags=["Graph Visualizer"])
def get_graph_topology_endpoint(
    limit: int = Query(500, description="Max entities to fetch"),
    start_date: Optional[str] = Query(None, description="Filter edges on or after YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="Filter edges on or before YYYY-MM-DD"),
    case_id: Optional[str] = Query(None, description="Filter graph by specific case docket/ID or 'ALL'"),
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Returns full Neo4j graph nodes and edges formatted strictly for Cytoscape.js.
    Supports case_id isolation and temporal date-range scrubbing over communication/financial edges.
    Applies PII masking (last 4 digits only) if the requesting user has the Investigator role.
    Supervisors and Admins receive full unmasked PII.
    """
    try:
        data = db.get_graph_topology(limit=limit, start_date=start_date, end_date=end_date, case_id=case_id)
        nodes = data["elements"]["nodes"]
        edges = data["elements"]["edges"]

        # Apply RBAC PII Masking if Investigator
        if user.get("role") == "Investigator":
            for n in nodes:
                ndata = n.get("data", {})
                if ndata.get("type") == "PhoneNumber" and ndata.get("number"):
                    masked = mask_pii_if_investigator(str(ndata["number"]), "Investigator")
                    ndata["number"] = masked
                    ndata["label"] = masked
                    ndata["displayName"] = masked
                elif ndata.get("type") == "BankAccount" and ndata.get("account_id"):
                    masked = mask_pii_if_investigator(str(ndata["account_id"]), "Investigator")
                    ndata["account_id"] = masked
                    ndata["label"] = masked
                    ndata["displayName"] = masked

        log_action(
            actor=user.get("actor", "Web Client"),
            action_type="FETCH_GRAPH_TOPOLOGY",
            action_detail=f"Retrieved topology: {len(nodes)} nodes, {len(edges)} edges (Case: {case_id or 'ALL'}, Temporal: {start_date} to {end_date}, Role: {user.get('role')})."
        )
        return {
            "status": "success",
            "user_role": user.get("role"),
            "pii_masked": user.get("role") == "Investigator",
            "case_filter": case_id or "ALL",
            "start_date_filter": start_date,
            "end_date_filter": end_date,
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "elements": {
                "nodes": nodes,
                "edges": edges
            }
        }
    except Exception as e:
        logger.error(f"Error fetching graph topology: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/api/v1/cases", tags=["Case Management"])
def get_cases_endpoint(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns list of all active Case Dockets and Criminal Syndicates registered in Neo4j.
    """
    try:
        cases = db.get_case_list()
        return {
            "status": "success",
            "total_cases": len(cases),
            "cases": cases
        }
    except Exception as e:
        logger.error(f"Error fetching case list: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.delete("/api/v1/cases/{case_id:path}", response_model=GenericResponse, tags=["Case Management"])
def delete_single_case_endpoint(
    case_id: str,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Deletes only nodes and relationships belonging to a single case docket without wiping the rest of the database.
    """
    try:
        deleted_count = db.delete_case(case_id)
        log_action(
            actor=user.get("actor", "Investigating Officer"),
            action_type="DELETE_CASE_DOCKET",
            action_detail=f"Deleted Case Docket '{case_id}' ({deleted_count} nodes removed) by {user.get('actor')}."
        )
        return GenericResponse(
            status="success",
            message=f"Case docket '{case_id}' successfully removed ({deleted_count} nodes deleted). Other cases remain intact."
        )
    except Exception as e:
        logger.error(f"Error deleting case {case_id}: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/api/v1/intelligence/geo", tags=["Graph Intelligence"])
def get_geo_intelligence_endpoint(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Returns geo-coordinates for all entities mapped across regional police jurisdiction clusters and cell towers.
    """
    try:
        result = get_geo_intelligence_overlay()
        log_action(
            actor=user.get("actor", "Intelligence Engine"),
            action_type="FETCH_GEO_OVERLAY",
            action_detail=f"Fetched geospatial intelligence overlay ({result['total_geo_markers']} active markers)."
        )
        return result
    except Exception as e:
        logger.error(f"Error fetching geo intelligence overlay: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))



@app.post("/api/v1/chat", response_model=ChatResponse, tags=["AI Investigator Copilot"])
def chat_copilot_endpoint(
    payload: ChatRequest,
    user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Law Enforcement AI Copilot endpoint powered by Groq LLM with real-time Neo4j graph context.
    Answers tactical investigative queries referencing CDR logs, banking structuring, and crime syndicates.
    """
    try:
        reply_text = chat_with_copilot(payload.message)
        log_action(
            actor=user.get("actor", "Investigating Officer"),
            action_type="COPILOT_QUERY",
            action_detail=f"Query: {payload.message[:80]}..."
        )
        return ChatResponse(
            status="success",
            reply=reply_text
        )
    except Exception as e:
        logger.error(f"Error executing AI copilot chat: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


# ==============================================================================
# Blockchain / Tamper-Evident Audit Trail Endpoints
# ==============================================================================

@app.get("/api/v1/audit/verify", response_model=AuditVerificationResponse, tags=["Audit Trail"])
def verify_audit_trail_endpoint():
    """
    Cryptographic verification endpoint for the tamper-evident hash chain.
    Recalculates SHA-256 hash chains from genesis block through all recorded actions.
    Returns whether the ledger integrity is intact or if any tampering was detected.
    """
    try:
        result = verify_audit_chain()
        return AuditVerificationResponse(**result)
    except Exception as e:
        logger.error(f"Error verifying audit trail: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.get("/api/v1/audit/logs", tags=["Audit Trail"])
def get_audit_logs_endpoint(limit: int = Query(50, description="Number of recent logs to fetch")):
    """
    Returns recent tamper-evident hash-chained audit log entries.
    """
    try:
        logs = get_recent_audit_logs(limit=limit)
        return {
            "status": "success",
            "total": len(logs),
            "logs": logs
        }
    except Exception as e:
        logger.error(f"Error retrieving audit logs: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@app.delete("/api/v1/admin/clear-db", response_model=GenericResponse, tags=["Admin"])
def clear_database_endpoint(user: Dict[str, Any] = Depends(get_current_user)):
    """
    Purges all case nodes and relationships from Neo4j database:
    MATCH (n) DETACH DELETE n
    REQUIRES: Admin role. Rejected with 403 Forbidden for Investigator or Supervisor roles.
    IMPORTANT: Case data is ephemeral by design, but the audit trail is permanent and immutable.
    A tamper-evident audit record is appended logging that the purge occurred.
    """
    try:
        # 1. Enforce RBAC Admin check
        require_admin(user)

        purge_query = "MATCH (n) DETACH DELETE n"
        db.execute_query(purge_query)
        clear_document_store()
        
        result = db.execute_query("MATCH (n) RETURN count(n) AS c")
        node_count = result[0]["c"] if result and len(result) > 0 else 0
        assert node_count == 0, f"Purge failed — {node_count} nodes remain in database"
        
        # 2. Log purge in the permanent audit ledger with authentic actor
        log_action(
            actor=user.get("actor", "Admin: sysadmin"),
            action_type="PURGE_DATABASE",
            action_detail=f"Purged all ephemeral case data from Neo4j (0 nodes remaining) by {user.get('actor')}."
        )
        
        logger.warning(f"Neo4j database purged successfully by {user.get('actor')}. Verified {node_count} nodes remaining.")
        return GenericResponse(
            status="success",
            message=f"Case data purged from Neo4j (verified 0 nodes remaining) by {user.get('actor')}. Action recorded immutably in the tamper-evident audit ledger."
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error purging database: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
