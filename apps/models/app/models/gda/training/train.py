from transformers import TrainingArguments, Trainer, DataCollatorForSeq2Seq

from .model import tokenizer, model
from .dataset import dataset
from ...lib.hf import hf_login

hf_login()

HF_REPO = "asobirov/dga-detector-Llama-3.2-3B-Instruct-lora"

training_args = TrainingArguments(
    output_dir="./gda-llama3.2-lora",
    per_device_train_batch_size=2,
    gradient_accumulation_steps=8,
    logging_steps=10,
    save_strategy="epoch",
    num_train_epochs=3,
    learning_rate=2e-4,
    fp16=True,
    report_to="none",
)

collator = DataCollatorForSeq2Seq(tokenizer=tokenizer, model=model, padding="max_length")

def tokenize(batch):
    prompts = [
        f"{instr}\n{inp}" if inp else instr
        for instr, inp in zip(batch["instruction"], batch["input"])
    ]

    model_inputs = tokenizer(
        prompts,
        truncation=True,
        padding="longest",
        return_tensors=None
    )

    targets = tokenizer(
        batch["output"],
        truncation=True,
        padding="longest",
        return_tensors=None
    )

    model_inputs["labels"] = targets["input_ids"]
    return model_inputs


remove_columns = getattr(dataset["train"], "column_names", None)
tokenized_ds = dataset.map(tokenize, batched=True, remove_columns=remove_columns, num_proc=8, load_from_cache_file=True)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=tokenized_ds["train"],
    eval_dataset=tokenized_ds["test"],
    tokenizer=tokenizer,
    data_collator=collator,
)

if __name__ == "__main__":
    trainer.train()

    model.save_pretrained(HF_REPO)
    model.push_to_hub(HF_REPO)
    tokenizer.push_to_hub(HF_REPO)
