from huggingface_hub import login
from dotenv import load_dotenv
import os


def hf_login():
    dotenv_path = os.path.join(os.path.dirname(__file__), "../../../../.env")
    load_dotenv(dotenv_path)
    
    login(token=os.getenv("HF_TOKEN"))
