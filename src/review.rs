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
        let diff = match get_diff(&base) {
            Ok(d) => d,
            Err(e) => {
                let _ = tx.send(ReviewState::Error(e));
                return;
            }
        };

        let result = if tool == "claude" {
            run_claude(&diff)
        } else {
            run_codex(&diff)
        };

        let _ = tx.send(result);
    });

    rx
}

fn get_diff(base: &str) -> Result<String, String> {
    // Try three-dot diff first
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

const REVIEW_PROMPT: &str = "Review this code diff. Identify potential bugs, code quality issues, and suggest improvements. Be concise and actionable.";

fn run_claude(diff: &str) -> ReviewState {
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
            ReviewState::Done(String::from_utf8_lossy(&o.stdout).to_string())
        }
        Ok(o) => {
            let err = String::from_utf8_lossy(&o.stderr).to_string();
            let out = String::from_utf8_lossy(&o.stdout).to_string();
            ReviewState::Error(if err.is_empty() { out } else { err })
        }
        Err(e) => ReviewState::Error(format!("claude error: {e}")),
    }
}

fn run_codex(diff: &str) -> ReviewState {
    // Write diff to temp file for codex to read (PID-unique to avoid collision)
    let diff_path = std::env::temp_dir().join(format!("gitt-review-{}.diff", std::process::id()));
    if let Err(e) = std::fs::write(&diff_path, diff) {
        return ReviewState::Error(format!("Failed to write temp file: {e}"));
    }

    let prompt = format!(
        "{} The diff file is at: {}",
        REVIEW_PROMPT,
        diff_path.display()
    );

    let result = Command::new("codex")
        .args(["-q", &prompt])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output();

    let _ = std::fs::remove_file(&diff_path);

    match result {
        Ok(o) if o.status.success() => {
            ReviewState::Done(String::from_utf8_lossy(&o.stdout).to_string())
        }
        Ok(o) => {
            let err = String::from_utf8_lossy(&o.stderr).to_string();
            let out = String::from_utf8_lossy(&o.stdout).to_string();
            ReviewState::Error(if err.is_empty() { out } else { err })
        }
        Err(_) => ReviewState::Error("codex CLI not found".into()),
    }
}
