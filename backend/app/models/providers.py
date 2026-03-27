from enum import Enum

from pydantic import BaseModel, Field


class Provider(str, Enum):
    OPENAI = "openai"
    GEMINI = "gemini"
    CUSTOM = "custom"


class ProviderConfig(BaseModel):
    base_url: str
    default_model: str
    extra_kwargs: dict = Field(default_factory=dict)


PROVIDER_DEFAULTS = {
    Provider.OPENAI: ProviderConfig(
        base_url="https://api.openai.com/v1", default_model="gpt-3.5-turbo"
    ),
    Provider.GEMINI: ProviderConfig(
        base_url="https://generativelanguage.googleapis.com/v1beta/openai",
        default_model="gemini-3-flash-preview",
    ),
    Provider.CUSTOM: ProviderConfig(base_url="", default_model=""),
}
