def format_instructions(row):
    return {
        "instruction": f"Classify whether this domain is algorithmically generated (DGA): {row['domain']}",
        "output": "Yes" if row["label"] == "DGA" else "No",
    }
