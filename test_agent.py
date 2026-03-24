import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'boxity_backend')))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), 'boxity_backend', '.env'))

from api.agent import PerceptionAgentTool, ReasoningAgent, AgentOrchestrator

print("Imports successful!")

# Try initializing reasoning agent
try:
    ra = ReasoningAgent()
    print("Reasoning agent initialized.")
except Exception as e:
    print(f"Failed to init ReasoningAgent: {e}")
