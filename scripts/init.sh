#!/bin/bash

set -e

WORKFLOW_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_ROOT="$(cd "$WORKFLOW_ROOT/.." && pwd)"
PROJECT_REPO="$WORKSPACE_ROOT/project"
WORKERS_ROOT="$WORKSPACE_ROOT/workers"
CONFIG_FILE="${WORKFLOW_CONFIG_FILE:-$WORKFLOW_ROOT/config/workflow.env}"

if [ -f "$CONFIG_FILE" ]; then
    set -a
    . "$CONFIG_FILE"
    set +a
fi

WORKFLOW_REMOTE="${WORKFLOW_REMOTE:-}"
PROJECT_REMOTE="${PROJECT_REMOTE:-}"
PROJECT_MAIN_BRANCH="${PROJECT_MAIN_BRANCH:-main}"
WORKER_COUNT="${WORKER_COUNT:-5}"

mkdir -p "$WORKFLOW_ROOT/tasks" "$WORKFLOW_ROOT/state" "$WORKFLOW_ROOT/logs" "$WORKFLOW_ROOT/runtime"
mkdir -p "$WORKERS_ROOT"

if [ ! -f "$WORKFLOW_ROOT/dev-task.lock" ]; then
cat > "$WORKFLOW_ROOT/dev-task.lock" << 'EOF'
{
  "version": "1.0",
  "locks": []
}
EOF
fi

if [ ! -f "$WORKFLOW_ROOT/dev-tasks.json" ]; then
cat > "$WORKFLOW_ROOT/dev-tasks.json" << 'EOF'
{
  "version": "1.0",
  "tasks": []
}
EOF
fi

if [ -n "$WORKFLOW_REMOTE" ]; then
    CURRENT_WORKFLOW_REMOTE="$(git -C "$WORKFLOW_ROOT" remote get-url origin 2>/dev/null || true)"
    if [ -z "$CURRENT_WORKFLOW_REMOTE" ]; then
        git -C "$WORKFLOW_ROOT" remote add origin "$WORKFLOW_REMOTE"
    elif [ "$CURRENT_WORKFLOW_REMOTE" != "$WORKFLOW_REMOTE" ]; then
        git -C "$WORKFLOW_ROOT" remote set-url origin "$WORKFLOW_REMOTE"
    fi
fi

if [ ! -d "$PROJECT_REPO/.git" ]; then
    SOURCE_REMOTE="$PROJECT_REMOTE"
    if [ -z "$SOURCE_REMOTE" ]; then
        SOURCE_REMOTE="$(git -C "$WORKFLOW_ROOT" remote get-url origin 2>/dev/null || true)"
    fi
    if [ -n "$SOURCE_REMOTE" ]; then
        git clone "$SOURCE_REMOTE" "$PROJECT_REPO"
    else
        git clone "$WORKFLOW_ROOT" "$PROJECT_REPO"
    fi
fi

if [ -n "$PROJECT_REMOTE" ]; then
    CURRENT_PROJECT_REMOTE="$(git -C "$PROJECT_REPO" remote get-url origin 2>/dev/null || true)"
    if [ -z "$CURRENT_PROJECT_REMOTE" ]; then
        git -C "$PROJECT_REPO" remote add origin "$PROJECT_REMOTE"
    elif [ "$CURRENT_PROJECT_REMOTE" != "$PROJECT_REMOTE" ]; then
        git -C "$PROJECT_REPO" remote set-url origin "$PROJECT_REMOTE"
    fi
fi

for i in $(seq 1 "$WORKER_COUNT"); do
    WORKER_BRANCH="worker-$i"
    WORKER_DIR="$WORKERS_ROOT/w$i"

    git -C "$PROJECT_REPO" fetch origin "$PROJECT_MAIN_BRANCH" >/dev/null 2>&1 || true
    git -C "$PROJECT_REPO" show-ref --verify --quiet "refs/heads/$WORKER_BRANCH" || \
        git -C "$PROJECT_REPO" branch "$WORKER_BRANCH" "origin/$PROJECT_MAIN_BRANCH" 2>/dev/null || \
        git -C "$PROJECT_REPO" branch "$WORKER_BRANCH"

    if [ ! -e "$WORKER_DIR/.git" ]; then
        git -C "$PROJECT_REPO" worktree add "$WORKER_DIR" "$WORKER_BRANCH"
    fi

    ln -sf "../../workflow/dev-tasks.json" "$WORKER_DIR/dev-tasks.json"
    ln -sf "../../workflow/dev-task.lock" "$WORKER_DIR/dev-task.lock"
    [ -f "$WORKFLOW_ROOT/api-key.json" ] && ln -sf "../../workflow/api-key.json" "$WORKER_DIR/api-key.json"
    ln -sf "../../workflow/AGENT.md" "$WORKER_DIR/AGENT.md"

    mkdir -p "$WORKER_DIR/data"
    rm -f "$WORKER_DIR/STATUS.txt"

    git -C "$WORKER_DIR" config user.email "worker-$i@ralph.loop"
    git -C "$WORKER_DIR" config user.name "Worker $i"
done

echo "✅ 初始化完成"
echo "workflow: $WORKFLOW_ROOT"
echo "project : $PROJECT_REPO"
echo "workflow remote: ${WORKFLOW_REMOTE:-<empty>}"
echo "project remote : ${PROJECT_REMOTE:-<empty>}"
echo "main branch    : $PROJECT_MAIN_BRANCH"
echo "workers : $WORKERS_ROOT/w1 ... w$WORKER_COUNT"
