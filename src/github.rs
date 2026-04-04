use std::process::Command;

#[derive(Debug, Clone)]
pub struct PullRequest {
    pub number: u64,
    pub title: String,
    pub state: String,
    pub author: String,
    pub branch: String,
    pub additions: u64,
    pub deletions: u64,
    pub review_decision: String,
    pub checks_status: String,
    pub url: String,
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
            "--json", "number,title,state,author,headRefName,additions,deletions,reviewDecision,statusCheckRollup,url",
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
                state: pr.get("state")?.as_str()?.to_string(),
                author: pr.get("author")?.get("login")?.as_str()?.to_string(),
                branch: pr.get("headRefName")?.as_str()?.to_string(),
                additions: pr.get("additions")?.as_u64().unwrap_or(0),
                deletions: pr.get("deletions")?.as_u64().unwrap_or(0),
                review_decision: pr.get("reviewDecision")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                checks_status: checks,
                url: pr.get("url")?.as_str()?.to_string(),
            })
        })
        .collect()
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
