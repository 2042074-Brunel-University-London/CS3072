def normalize_harpo(row: dict):
    return {
        "domain": row["domain"],
        "label": "DGA" if row["class"] == 1 else "Benign",
    }


def normalize_yang(row: dict):
    return {
        "domain": row["Domain"],
        "label": "DGA" if row["Label"] == 1 else "Benign",
    }
