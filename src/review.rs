use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;

#[derive(Debug, Clone)]
pub enum ReviewState {
    Idle,
    Running,
    Done(String),
    Error(String),
}

#[derive(Debug, Clone)]
pub enum ReviewMode {
    Branch(String),  // base branch name
    Uncommitted,
}

impl ReviewMode {
    pub fn label(&self) -> &str {
        match self {
            ReviewMode::Branch(_) => "branch diff",
            ReviewMode::Uncommitted => "working changes",
        }
    }
}

pub fn start_review(tool: &str, mode: ReviewMode) -> mpsc::Receiver<ReviewState> {
    let (tx, rx) = mpsc::channel();
    let tool = tool.to_string();

    thread::spawn(move || {
        let result = match (&*tool, &mode) {
            ("claude", ReviewMode::Branch(base)) => run_claude_branch(base),
            ("claude", ReviewMode::Uncommitted) => run_claude_uncommitted(),
            (_, ReviewMode::Branch(base)) => run_codex_branch(base),
            (_, ReviewMode::Uncommitted) => run_codex_uncommitted(),
        };

        let _ = tx.send(result);
    });

    rx
}

const REVIEW_PROMPT: &str = "Review this code diff. Identify potential bugs, code quality issues, and suggest improvements. Be concise and actionable.";

// --- Codex ---

fn run_codex_branch(base: &str) -> ReviewState {
    run_codex_cmd(&["review", "--base", base])
}

fn run_codex_uncommitted() -> ReviewState {
    run_codex_cmd(&["review", "--uncommitted"])
}

fn run_codex_cmd(args: &[&str]) -> ReviewState {
    let result = Command::new("codex")
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    match result {
        Ok(o) if o.status.success() => {
            let out = String::from_utf8_lossy(&o.stdout).to_string();
            if out.trim().is_empty() {
                ReviewState::Done("No issues found.".into())
            } else {
                ReviewState::Done(out)
            }
        }
        Ok(o) => {
            let err = String::from_utf8_lossy(&o.stderr).to_string();
            let out = String::from_utf8_lossy(&o.stdout).to_string();
            let msg = if err.is_empty() { out } else { err };
            ReviewState::Error(msg.trim().to_string())
        }
        Err(_) => ReviewState::Error("codex CLI not found".into()),
    }
}

// --- Claude ---

fn run_claude_branch(base: &str) -> ReviewState {
    let diff = match get_diff_branch(base) {
        Ok(d) => d,
        Err(e) => return ReviewState::Error(e),
    };
    run_claude_with_diff(&diff)
}

fn run_claude_uncommitted() -> ReviewState {
    let diff = match get_diff_uncommitted() {
        Ok(d) => d,
        Err(e) => return ReviewState::Error(e),
    };
    run_claude_with_diff(&diff)
}

fn run_claude_with_diff(diff: &str) -> ReviewState {
    let mut child = match Command::new("claude")
        .args(["-p", REVIEW_PROMPT])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(c) => c,
        Err(_) => return ReviewState::Error("claude CLI not found".into()),
    };

    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(diff.as_bytes());
    }

    match child.wait_with_output() {
        Ok(o) if o.status.success() => {
            let out = String::from_utf8_lossy(&o.stdout).to_string();
            if out.trim().is_empty() {
                ReviewState::Done("No issues found.".into())
            } else {
                ReviewState::Done(out)
            }
        }
        Ok(o) => {
            let err = String::from_utf8_lossy(&o.stderr).to_string();
            let out = String::from_utf8_lossy(&o.stdout).to_string();
            let msg = if err.is_empty() { out } else { err };
            ReviewState::Error(msg.trim().to_string())
        }
        Err(e) => ReviewState::Error(format!("claude error: {e}")),
    }
}

// --- Diff helpers ---

fn get_diff_branch(base: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(["diff", &format!("{base}...HEAD")])
        .output()
        .map_err(|e| format!("Failed to run git diff: {e}"))?;

    if output.status.success() {
        let text = String::from_utf8_lossy(&output.stdout).to_string();
        if !text.trim().is_empty() {
            return Ok(text);
        }
    }

    let output = Command::new("git")
        .args(["diff", base, "HEAD"])
        .output()
        .map_err(|e| format!("Failed to run git diff: {e}"))?;

    if !output.status.success() {
        return Err(format!("Failed to diff against {base}"));
    }

    let text = String::from_utf8_lossy(&output.stdout).to_string();
    if text.trim().is_empty() {
        return Err("No changes between current branch and base".into());
    }
    Ok(text)
}

fn get_diff_uncommitted() -> Result<String, String> {
    // git diff HEAD shows both staged and unstaged changes
    let output = Command::new("git")
        .args(["diff", "HEAD"])
        .output()
        .map_err(|e| format!("Failed to run git diff: {e}"))?;

    if !output.status.success() {
        return Err("Failed to get working tree diff".into());
    }

    let text = String::from_utf8_lossy(&output.stdout).to_string();
    if text.trim().is_empty() {
        return Err("No uncommitted changes".into());
    }
    Ok(text)
}
