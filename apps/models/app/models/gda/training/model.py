from transformers import AutoTokenizer, AutoModelForCausalLM
from peft import prepare_model_for_kbit_training, get_peft_model, LoraConfig
from accelerate import disk_offload
import platform
import torch
import os

from ...lib.hf import hf_login

hf_login()

model_name = "meta-llama/Llama-3.2-3B-Instruct"

tokenizer = AutoTokenizer.from_pretrained(model_name, use_fast=True)
tokenizer.pad_token = tokenizer.eos_token

# Configure device mapping and quantization based on OS
is_macos = platform.system() == "Darwin"
device_map = "auto"
quantization_config = None

if not is_macos:
    quantization_config = {"load_in_4bit": True}
    # Ensure we have enough GPU memory
    if torch.cuda.is_available():
        device_map = {"": 0}  # Use first GPU

# Create cache directory for disk offloading
cache_dir = os.path.join(os.path.dirname(__file__), "model_cache")
os.makedirs(cache_dir, exist_ok=True)

model = AutoModelForCausalLM.from_pretrained(
    model_name,
    trust_remote_code=True,
    device_map=device_map,
    quantization_config=quantization_config,
)

model = prepare_model_for_kbit_training(model)

lora_config = LoraConfig(
    r=16,
    lora_alpha=16,
    lora_dropout=0.05,
    bias="none",
    task_type="CAUSAL_LM",
    target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
)

model = get_peft_model(model, lora_config)
