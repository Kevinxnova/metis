"""Backfill trending_score and ai_intro for all tools. Resilient to connection errors."""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

import logging
logging.basicConfig(level=logging.WARNING, format='%(asctime)s %(message)s')

from backend.db import init_db
from backend.db.queries import get_unscored_tool_ids, get_tools_without_intro
from backend.ai_recommend import score_tools, generate_intros

init_db()

def run_scoring():
    total = 0
    consecutive_fails = 0
    BATCH = 10
    while True:
        ids = get_unscored_tool_ids(limit=BATCH)
        if not ids:
            break
        try:
            n, errs = score_tools(ids)
            total += n
            consecutive_fails = 0
            print(f'[score] +{n} (total: {total})')
        except Exception as e:
            consecutive_fails += 1
            print(f'[score] ERR #{consecutive_fails}: {str(e)[:80]}')
            if consecutive_fails >= 20:
                print(f'[score] Stopping after {consecutive_fails} consecutive failures')
                break
            time.sleep(5 * consecutive_fails)  # exponential backoff
            continue
        time.sleep(2)
    return total

def run_intros():
    total = 0
    consecutive_fails = 0
    BATCH = 5
    while True:
        ids = get_tools_without_intro(limit=BATCH)
        if not ids:
            break
        try:
            n, errs = generate_intros(ids)
            total += n
            consecutive_fails = 0
            print(f'[intro] +{n} (total: {total})')
        except Exception as e:
            consecutive_fails += 1
            print(f'[intro] ERR #{consecutive_fails}: {str(e)[:80]}')
            if consecutive_fails >= 20:
                print(f'[intro] Stopping after {consecutive_fails} consecutive failures')
                break
            time.sleep(5 * consecutive_fails)
            continue
        time.sleep(2)
    return total

if __name__ == '__main__':
    task = sys.argv[1] if len(sys.argv) > 1 else 'all'

    if task in ('score', 'all'):
        remaining = len(get_unscored_tool_ids(limit=2000))
        print(f'=== SCORING ({remaining} remaining) ===')
        scored = run_scoring()
        print(f'=== SCORING DONE: {scored} ===\n')

    if task in ('intro', 'all'):
        remaining = len(get_tools_without_intro(limit=2000))
        print(f'=== INTROS ({remaining} remaining) ===')
        introed = run_intros()
        print(f'=== INTROS DONE: {introed} ===\n')
