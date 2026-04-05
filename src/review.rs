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

pub fn start_review(tool: &str, base_branch: &str) -> mpsc::Receiver<ReviewState> {
    let (tx, rx) = mpsc::channel();
    let tool = tool.to_string();
    let base = base_branch.to_string();

    thread::spawn(move || {
        let result = if tool == "claude" {
            run_claude(&base)
        } else {
            run_codex(&base)
        };

        let _ = tx.send(result);
    });

    rx
}

const REVIEW_PROMPT: &str = "Review this code diff. Identify potential bugs, code quality issues, and suggest improvements. Be concise and actionable.";

fn run_codex(base: &str) -> ReviewState {
    // codex review --base <branch> runs a non-interactive code review
    let result = Command::new("codex")
        .args(["review", "--base", base])
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

fn run_claude(base: &str) -> ReviewState {
    // Get diff first, then pipe to claude -p
    let diff = match get_diff(base) {
        Ok(d) => d,
        Err(e) => return ReviewState::Error(e),
    };

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

fn get_diff(base: &str) -> Result<String, String> {
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

    // Fallback: two-dot diff
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
