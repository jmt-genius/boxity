import logging
import os
from typing import Dict, Any, List, Optional, Tuple, Type
from datetime import datetime
from pydantic import BaseModel, Field

from langchain_core.tools import BaseTool
from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

from .ai import call_gemini_ensemble

logger = logging.getLogger(__name__)

# ---------------------------------------------------------
# Models
# ---------------------------------------------------------

class DifferenceOutput(BaseModel):
    id: str = Field(description="Unique id for the difference")
    region: str = Field(description="Region where difference is located")
    bbox: List[float] = Field(description="Bounding box [x,y,w,h]")
    type: str = Field(description="Type of difference like dent, seal_tamper")
    description: str = Field(description="Text description")
    severity: str = Field(description="LOW, MEDIUM, or HIGH")
    confidence: float = Field(description="Confidence from 0.0 to 1.0")
    explainability: List[str] = Field(description="Reasons")
    suggested_action: str = Field(description="Action suggested")
    tis_delta: int = Field(description="Score delta")

class PerceptionOutput(BaseModel):
    differences: List[Dict[str, Any]]
    overall_confidence: float
    max_severity: str

class DecisionOutput(BaseModel):
    decision: str = Field(description="APPROVE, APPROVE WITH FLAG, QUARANTINE, or REANALYZE")
    reason: str = Field(description="Detailed reason for the decision")
    confidence_assessment: str = Field(description="Assessment of confidence levels")

class PerceptionToolInput(BaseModel):
    instruction: Optional[str] = Field(default=None, description="Optional focus instruction for the model")

# ---------------------------------------------------------
# Agent 1: Perception Agent Tool Wrapper
# ---------------------------------------------------------

class PerceptionAgentTool(BaseTool):
    name: str = "perception_agent_vision_diff"
    description: str = "Analyzes a baseline and current image to find differences and structural damage."
    args_schema: Type[BaseModel] = PerceptionToolInput
    
    baseline: Tuple[Optional[bytes], Optional[str]]
    current: Tuple[Optional[bytes], Optional[str]]

    def _run(self, instruction: Optional[str] = None) -> PerceptionOutput:
        """Executes the tool by passing image bytes and instruction to the AI."""
        logger.info(f"Running PerceptionAgentTool with instruction: {instruction}")
        differences_raw = call_gemini_ensemble(self.baseline, self.current, view_label=instruction)
        
        overall_confidence = 0.0
        max_severity = "LOW"
        severity_order = {"LOW": 1, "MEDIUM": 2, "HIGH": 3}
        
        if differences_raw:
            total_conf = sum(d.get("confidence", 0.0) for d in differences_raw)
            overall_confidence = float(total_conf / len(differences_raw))
            
            for d in differences_raw:
                sev = d.get("severity", "LOW")
                if severity_order.get(sev, 1) > severity_order.get(max_severity, 1):
                    max_severity = sev
                    
        return PerceptionOutput(
            differences=differences_raw,
            overall_confidence=overall_confidence,
            max_severity=max_severity
        )

# ---------------------------------------------------------
# Agent 2: Reasoning Agent
# ---------------------------------------------------------

class ReasoningAgent:
    def __init__(self):
        # Fetching API key internally
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if api_key:
            api_key = api_key.strip().strip('"').strip("'")
            
        if not api_key:
            logger.warning("[agent.py] API Key not found for reasoning agent.")
            
        self.llm = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash",
            api_key=api_key,
            temperature=0.0
        )
        self.structured_llm = self.llm.with_structured_output(DecisionOutput)
        
        template = """You are an expert supply chain integrity decision system.

Input:
Differences detected between baseline and current image: {differences}
Overall Confidence: {confidence}
Max Severity: {severity}

Task:
Decide whether the package should be approved, quarantined, or reanalyzed.

Rules:
- HIGH severity -> QUARANTINE
- Low confidence (< 0.65) -> REANALYZE
- Minor issues -> APPROVE (or APPROVE WITH FLAG if moderate issues exist)

Return only JSON:
{{
  "decision": "string",
  "reason": "string",
  "confidence_assessment": "string"
}}
"""
        self.prompt = PromptTemplate(
            template=template,
            input_variables=["differences", "confidence", "severity"]
        )
        
        # Creating a Runnable Sequence
        self.chain = self.prompt | self.structured_llm

    def evaluate(self, perception_output: PerceptionOutput) -> DecisionOutput:
        """Evaluates perception output and makes a business decision."""
        logger.info("Running ReasoningAgent logic...")
        
        response = self.chain.invoke({
            "differences": str(perception_output.differences),
            "confidence": perception_output.overall_confidence,
            "severity": perception_output.max_severity
        })
        return response

# ---------------------------------------------------------
# Stubs
# ---------------------------------------------------------

def trigger_action_agent(decision_data: DecisionOutput):
    """Stub function to simulate interacting with blockchain/action agents."""
    logger.info(f"[ACTION] Triggering quarantine based on reason: {decision_data.reason}")

def log_to_blockchain(decision_data: DecisionOutput):
    """Stub function to simulate IPFS/Blockchain approval logging."""
    logger.info(f"[BLOCKCHAIN] Logging approval. Reason: {decision_data.reason}")


# ---------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------

class AgentOrchestrator:
    """Manages the collaborative interaction between Perception and Reasoning agents."""
    def __init__(self, baseline_bytes: bytes, current_bytes: bytes, baseline_mime: str = "image/jpeg", current_mime: str = "image/jpeg"):
        baseline_tuple = (baseline_bytes, baseline_mime)
        current_tuple = (current_bytes, current_mime)
        
        self.perception_tool = PerceptionAgentTool(
            baseline=baseline_tuple, 
            current=current_tuple
        )
        self.reasoning_agent = ReasoningAgent()
        
    def execute(self) -> Dict[str, Any]:
        audit_log = []
        max_retries = 2
        min_confidence_for_acceptance = 0.70
        
        instruction = None
        final_decision: Optional[DecisionOutput] = None
        final_perception: Optional[PerceptionOutput] = None
        
        for attempt in range(max_retries + 1):
            iteration_number = attempt + 1
            logger.info(f"--- Iteration {iteration_number} ---")
            
            # Step 1: Perception
            perception_res: PerceptionOutput = self.perception_tool.invoke({"instruction": instruction})
            
            audit_log.append({
                "agent": "Perception Agent",
                "iteration": iteration_number,
                "step": "perception",
                "action": "Analyzed image pair for integrity differences",
                "output": perception_res.model_dump(),
                "timestamp": datetime.utcnow().isoformat()
            })
            final_perception = perception_res
            
            # Step 2: Reasoning
            try:
                decision_res: DecisionOutput = self.reasoning_agent.evaluate(perception_res)
            except Exception as e:
                logger.error(f"Reasoning agent failed: {e}")
                # Fallback on raw rule logic if LLM fails
                decision_res = DecisionOutput(
                    decision="QUARANTINE" if perception_res.max_severity == "HIGH" else "APPROVE",
                    reason=f"Fallback due to LLM error: {e}",
                    confidence_assessment="Unknown due to error"
                )
            
            reasoning_action = "Evaluated perception output and selected decision"
            final_decision = decision_res

            # Hard business rule: confidence below 70% must trigger re-analysis.
            if float(perception_res.overall_confidence or 0.0) < min_confidence_for_acceptance:
                if attempt < max_retries:
                    final_decision = DecisionOutput(
                        decision="REANALYZE",
                        reason=(
                            f"Overall confidence {perception_res.overall_confidence:.2f} is below "
                            f"{min_confidence_for_acceptance:.2f}; requesting another perception pass."
                        ),
                        confidence_assessment="Low"
                    )
                    reasoning_action = "Confidence gate triggered re-analysis"
                    instruction = "focus on structural damage, ignore lighting variations, improve confidence"
                    logger.info(
                        "Confidence %.2f below %.2f. Forcing REANALYZE.",
                        float(perception_res.overall_confidence or 0.0),
                        min_confidence_for_acceptance,
                    )
                else:
                    final_decision = DecisionOutput(
                        decision="QUARANTINE",
                        reason=(
                            f"Confidence remained below {min_confidence_for_acceptance:.2f} after "
                            f"{max_retries + 1} attempts."
                        ),
                        confidence_assessment="Low"
                    )
                    reasoning_action = "Max retries reached with low confidence"
                    logger.warning("Low confidence persisted after all retries; finalizing as QUARANTINE.")
            audit_log.append({
                "agent": "Reasoning Agent",
                "iteration": iteration_number,
                "step": "reasoning",
                "action": reasoning_action,
                "output": final_decision.model_dump(),
                "timestamp": datetime.utcnow().isoformat()
            })

            if reasoning_action == "Max retries reached with low confidence":
                break
            
            # Step 3: Collaborative Logic
            if final_decision.decision == "REANALYZE":
                if attempt < max_retries:
                    instruction = "focus on structural damage, ignore lighting variations"
                    logger.info("Decision was REANALYZE. Adjusting instructions for next iteration.")
                    continue
                else:
                    logger.warning("Max retries for REANALYZE reached. Defaulting to final state.")
                    break
            else:
                # Terminal decision reached (APPROVE or QUARANTINE)
                break
                
        # Fire actions based on the final decision
        if final_decision and final_decision.decision == "QUARANTINE":
            trigger_action_agent(final_decision)
        elif final_decision and final_decision.decision.startswith("APPROVE"):
            log_to_blockchain(final_decision)
            
        return {
            "final_decision": final_decision.decision if final_decision else "ERROR",
            "iterations": max((int(log.get("iteration", 0)) for log in audit_log if log.get("step") == "reasoning"), default=0),
            "final_differences": final_perception.differences if final_perception else [],
            "audit_log": audit_log
        }
