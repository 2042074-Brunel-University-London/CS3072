import re
from typing import Dict
from pydantic import BaseModel
from transformers import pipeline

from keybert import KeyBERT
from sentence_transformers import SentenceTransformer

text_nsfw_pipe = pipeline(
    "text-classification",
    model="eliasalbouzidi/distilbert-nsfw-text-classifier",
    truncation=True,
)

# Sentiment analysis (Positive/Neutral/Negative)
sentiment_pipe = pipeline(
    "sentiment-analysis",
    model="cardiffnlp/twitter-roberta-base-sentiment-latest",
    truncation=True,
)

# Topic classification
topic_pipe = pipeline(
    "zero-shot-classification",
    model="facebook/bart-large-mnli",
    truncation=True,
)

# Keyword extraction (KeyBERT with SentenceTransformer)
embed_model = SentenceTransformer("all-MiniLM-L6-v2")
kw_model = KeyBERT(model=embed_model)


class TextClassificationResult(BaseModel):
    is_text_nsfw: bool
    text_nsfw_score: float
    sentiment: str
    sentiment_score: float
    topics: Dict[str, float]


#  Minimal attempt to clean tags into a "readable" format
def clean_tag(tag: str) -> str:
    # Replace underscores/hyphens and split camel case, then title case
    s = tag.replace("_", " ").replace("-", " ")
    s = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", s)
    return s.title()


def split_into_words(text: str) -> list[str]:
    # Split text into words, handling various separators
    words = re.split(r"[\s\-_]+", text)
    # Filter out empty strings and convert to lowercase
    return [word.lower() for word in words if word]


def classify_text(text: str, tags: list[str]) -> TextClassificationResult:
    # NSFW detection on text
    print("=== NSFW detection on text")
    tx = text_nsfw_pipe(text)[0]
    is_nsfw = tx["label"].lower() == "nsfw"
    nsfw_score = float(tx["score"])

    # Sentiment
    print("=== Sentiment analysis")
    sv = sentiment_pipe(text)[0]
    sentiment = sv["label"].lower()
    sentiment_score = float(sv["score"])

    # Keyword extraction
    print("=== Keyword extraction")
    kw_results = kw_model.extract_keywords(
        text,
        keyphrase_ngram_range=(1, 1),
        stop_words="english",
        top_n=5,
    )
    keywords = [kw for kw, _ in kw_results]

    # Topic classification
    print("=== Topic classification", tags, keywords)
    cleaned_tags = list(dict.fromkeys(clean_tag(t) for t in tags))

    # Split all tags and keywords into individual words
    all_words = []
    for item in cleaned_tags + keywords:
        all_words.extend(split_into_words(item))

    unique_labels = list(dict.fromkeys(all_words))

    if unique_labels:
        print("=== Topic classification with labels", unique_labels)
        tv = topic_pipe(text, candidate_labels=unique_labels, multi_label=True)
        topics = {
            label.lower(): float(score)
            for label, score in zip(tv["labels"], tv["scores"])
        }
    else:
        topics = {"other": 1.0}

    return TextClassificationResult(
        is_text_nsfw=is_nsfw,
        text_nsfw_score=nsfw_score,
        sentiment=sentiment,
        sentiment_score=sentiment_score,
        topics=topics,
    )
