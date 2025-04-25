from datasets import (
    load_dataset,
    concatenate_datasets,
    DatasetDict,
)

from ..utils.normalize_dataset import normalize_harpo, normalize_yang
from ..utils.instructions import format_instructions

HF_DATASET_ID = "asobirov/dga-preprocessed"

try:
    dataset = load_dataset(HF_DATASET_ID)
except Exception:
    print("No remote dataset found. Building from scratch...")

    harpo_train = load_dataset("harpomaxx/dga-detection", split="train")
    harpo_test = load_dataset("harpomaxx/dga-detection", split="test")

    # YangYang-Research/dga-detection only has the train split
    yang_full = load_dataset("YangYang-Research/dga-detection", split="train")
    yang_split = yang_full.train_test_split(test_size=0.1)
    yang_train = yang_split["train"]
    yang_test = yang_split["test"]

    harpo_train = harpo_train.map(normalize_harpo)
    harpo_test = harpo_test.map(normalize_harpo)
    yang_train = yang_train.map(normalize_yang)
    yang_test = yang_test.map(normalize_yang)

    train_dataset = concatenate_datasets([harpo_train, yang_train]).map(
        format_instructions,
        remove_columns=["class", "idx", "Domain", "Label"],
    )

    test_dataset = concatenate_datasets([harpo_test, yang_test]).map(
        format_instructions,
        remove_columns=["class", "idx", "Domain", "Label"],
    )

    dataset = DatasetDict({"train": train_dataset, "test": test_dataset})

    dataset.push_to_hub(HF_DATASET_ID, private=True)
