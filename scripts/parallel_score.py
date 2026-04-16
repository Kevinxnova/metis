"""Parallel scoring: split unscored tools into N groups, score concurrently."""
import os, sys, json, time
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

from backend.db import get_db, init_db
from backend.ai_recommend import score_tools

init_db()

# Get remaining unscored tool IDs from this week
with get_db() as db:
    rows = db.execute(
        "SELECT id FROM tools WHERE trending_score IS NULL AND first_seen >= date('now', '-7 days') ORDER BY first_seen DESC"
    ).fetchall()
all_ids = [r['id'] for r in rows]
print(f"Unscored tools: {len(all_ids)}")

if not all_ids:
    print("Nothing to score!")
    sys.exit(0)

# Split into N groups
N_WORKERS = 5
CHUNK = 30  # each worker scores 30 at a time
groups = [all_ids[i::N_WORKERS] for i in range(N_WORKERS)]
for i, g in enumerate(groups):
    print(f"  Worker {i}: {len(g)} tools")


def score_group(worker_id, tool_ids):
    """Score a group of tools in chunks."""
    scored = 0
    errors = []
    for i in range(0, len(tool_ids), CHUNK):
        batch = tool_ids[i:i + CHUNK]
        for attempt in range(3):
            try:
                n, errs = score_tools(batch)
                scored += n
                errors.extend(errs)
                break
            except Exception as e:
                if attempt < 2:
                    time.sleep(2)
                else:
                    errors.append(f"worker{worker_id} batch {i}: {str(e)[:80]}")
    return worker_id, scored, errors


# Run in parallel
print(f"\nStarting {N_WORKERS} parallel workers...")
start = time.time()
total_scored = 0
total_errors = []

with ThreadPoolExecutor(max_workers=N_WORKERS) as executor:
    futures = {executor.submit(score_group, i, g): i for i, g in enumerate(groups)}
    for future in as_completed(futures):
        worker_id, scored, errors = future.result()
        total_scored += scored
        total_errors.extend(errors)
        elapsed = time.time() - start
        print(f"  Worker {worker_id} done: {scored} scored, {len(errors)} errors ({elapsed:.0f}s)")

elapsed = time.time() - start
print(f"\n=== SCORING COMPLETE ===")
print(f"Total: {total_scored}/{len(all_ids)} in {elapsed:.0f}s")
print(f"Errors: {len(total_errors)}")
if total_errors:
    for e in total_errors[:5]:
        print(f"  {e[:120]}")

# Verify
with get_db() as db:
    scored = db.execute("SELECT COUNT(*) as c FROM tools WHERE trending_score IS NOT NULL AND first_seen >= date('now', '-7 days')").fetchone()['c']
    print(f"\nVerification: {scored}/698 this week scored")
