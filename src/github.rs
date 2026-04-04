use std::process::Command;
use std::sync::mpsc;
use std::thread;
use std::time::Instant;

#[derive(Debug, Clone)]
pub struct PullRequest {
    pub number: u64,
    pub title: String,
    pub additions: u64,
    pub deletions: u64,
    pub review_decision: String,
    pub checks_status: String,
}

#[derive(Debug, Clone)]
pub enum GhStatus {
    NotInstalled,
    NotAuthenticated,
    Ready,
}

pub fn check_gh() -> GhStatus {
    let output = Command::new("gh").arg("--version").output();
    if output.is_err() {
        return GhStatus::NotInstalled;
    }

    let auth = Command::new("gh")
        .args(["auth", "status"])
        .output();
    match auth {
        Ok(o) if o.status.success() => GhStatus::Ready,
        _ => GhStatus::NotAuthenticated,
    }
}

pub fn load_prs() -> Vec<PullRequest> {
    let output = Command::new("gh")
        .args([
            "pr", "list",
            "--json", "number,title,additions,deletions,reviewDecision,statusCheckRollup",
            "--limit", "20",
        ])
        .output();

    let output = match output {
        Ok(o) if o.status.success() => o,
        _ => return Vec::new(),
    };

    let json: serde_json::Value = match serde_json::from_slice(&output.stdout) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let arr = match json.as_array() {
        Some(a) => a,
        None => return Vec::new(),
    };

    arr.iter()
        .filter_map(|pr| {
            let checks = pr.get("statusCheckRollup")
                .and_then(|v| v.as_array())
                .map(|checks| summarize_checks(checks))
                .unwrap_or_else(|| "—".to_string());

            Some(PullRequest {
                number: pr.get("number")?.as_u64()?,
                title: pr.get("title")?.as_str()?.to_string(),
                additions: pr.get("additions")?.as_u64().unwrap_or(0),
                deletions: pr.get("deletions")?.as_u64().unwrap_or(0),
                review_decision: pr.get("reviewDecision")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                checks_status: checks,
            })
        })
        .collect()
}

pub struct PrLoader {
    rx: mpsc::Receiver<(GhStatus, Vec<PullRequest>)>,
    last_refresh: Instant,
}

const PR_REFRESH_INTERVAL_SECS: u64 = 30;

impl PrLoader {
    pub fn spawn() -> Self {
        let (tx, rx) = mpsc::channel();
        thread::spawn(move || {
            let status = check_gh();
            let prs = match &status {
                GhStatus::Ready => load_prs(),
                _ => Vec::new(),
            };
            let _ = tx.send((status, prs));
        });
        Self {
            rx,
            last_refresh: Instant::now(),
        }
    }

    pub fn try_recv(&self) -> Option<(GhStatus, Vec<PullRequest>)> {
        self.rx.try_recv().ok()
    }

    pub fn refresh(&mut self) -> Option<mpsc::Receiver<(GhStatus, Vec<PullRequest>)>> {
        if self.last_refresh.elapsed().as_secs() < PR_REFRESH_INTERVAL_SECS {
            return None;
        }
        self.last_refresh = Instant::now();
        let (tx, rx) = mpsc::channel();
        thread::spawn(move || {
            let status = check_gh();
            let prs = match &status {
                GhStatus::Ready => load_prs(),
                _ => Vec::new(),
            };
            let _ = tx.send((status, prs));
        });
        Some(rx)
    }
}

fn summarize_checks(checks: &[serde_json::Value]) -> String {
    if checks.is_empty() {
        return "—".to_string();
    }

    let mut pass = 0;
    let mut fail = 0;
    let mut pending = 0;

    for check in checks {
        // statusCheckRollup items can have "conclusion" or "status"
        let conclusion = check.get("conclusion")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let status = check.get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        match conclusion {
            "SUCCESS" | "NEUTRAL" | "SKIPPED" => pass += 1,
            "FAILURE" | "TIMED_OUT" | "CANCELLED" | "ACTION_REQUIRED" => fail += 1,
            _ => {
                if status == "COMPLETED" {
                    pass += 1;
                } else {
                    pending += 1;
                }
            }
        }
    }

    if fail > 0 {
        format!("{fail} failed")
    } else if pending > 0 {
        format!("{pending} pending")
    } else {
        format!("{pass} passed")
    }
}
