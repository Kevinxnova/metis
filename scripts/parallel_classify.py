"""Parallel classification: re-classify 'other' tools into news/ai_tool/other."""
import os, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

from backend.db import get_db, init_db
from backend.ai_recommend import categorize_tools

init_db()

# Get tools that are 'other' this week (likely unclassified defaults)
with get_db() as db:
    rows = db.execute(
        "SELECT id FROM tools WHERE discovery_category = 'other' AND first_seen >= date('now', '-7 days') ORDER BY first_seen DESC"
    ).fetchall()
all_ids = [r['id'] for r in rows]
print(f"Tools to re-classify: {len(all_ids)}")

if not all_ids:
    print("Nothing to classify!")
    sys.exit(0)

N_WORKERS = 3
CHUNK = 50

groups = [all_ids[i::N_WORKERS] for i in range(N_WORKERS)]
for i, g in enumerate(groups):
    print(f"  Worker {i}: {len(g)} tools")


def classify_group(worker_id, tool_ids):
    """Classify a group of tools in chunks."""
    # Stagger worker starts to avoid thundering herd
    time.sleep(worker_id * 3)
    classified = 0
    errors = []
    for i in range(0, len(tool_ids), CHUNK):
        batch = tool_ids[i:i + CHUNK]
        for attempt in range(3):
            try:
                n, errs = categorize_tools(batch)
                classified += n
                errors.extend(errs)
                print(f"  Worker {worker_id}: batch {i}-{i+CHUNK} done ({n} classified)")
                break
            except Exception as e:
                if attempt < 2:
                    time.sleep(5 + attempt * 5)
                else:
                    errors.append(f"worker{worker_id} batch {i}: {str(e)[:80]}")
        time.sleep(2)  # pause between batches
    return worker_id, classified, errors


print(f"\nStarting {N_WORKERS} parallel workers...")
start = time.time()
total_classified = 0
total_errors = []

with ThreadPoolExecutor(max_workers=N_WORKERS) as executor:
    futures = {executor.submit(classify_group, i, g): i for i, g in enumerate(groups)}
    for future in as_completed(futures):
        worker_id, classified, errors = future.result()
        total_classified += classified
        total_errors.extend(errors)
        elapsed = time.time() - start
        print(f"  Worker {worker_id} done: {classified} classified, {len(errors)} errors ({elapsed:.0f}s)")

elapsed = time.time() - start
print(f"\n=== CLASSIFICATION COMPLETE ===")
print(f"Total: {total_classified}/{len(all_ids)} in {elapsed:.0f}s")
print(f"Errors: {len(total_errors)}")
if total_errors:
    for e in total_errors[:5]:
        print(f"  {e[:120]}")

# Verify
with get_db() as db:
    rows = db.execute(
        "SELECT discovery_category, COUNT(*) as c FROM tools WHERE first_seen >= date('now', '-7 days') GROUP BY discovery_category ORDER BY c DESC"
    ).fetchall()
    print(f"\nVerification - this week's categories:")
    for r in rows:
        print(f"  {r['discovery_category']}: {r['c']}")
