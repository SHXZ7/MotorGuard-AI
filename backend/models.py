from pydantic import BaseModel, Field

class SensorData(BaseModel):
    rpm: int
    voltage: float
    current: float
    temperature: float
    vibration: float


class ChatTurn(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    question: str
    history: list[ChatTurn] = Field(default_factory=list)
    top_k: int = 8
