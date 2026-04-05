use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default = "default_tabs")]
    pub tabs: TabsConfig,
    #[serde(default = "default_refresh_interval")]
    pub refresh_interval: u64,
    #[serde(default = "default_true")]
    pub mouse_enabled: bool,
    #[serde(default = "default_true")]
    pub auto_update_check: bool,
    #[serde(default = "default_review_tool")]
    pub review_tool: String,
    #[serde(default = "default_false")]
    pub auto_review: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TabsConfig {
    #[serde(default = "default_true")]
    pub status: bool,
    #[serde(default = "default_true")]
    pub branch: bool,
    #[serde(default = "default_true")]
    pub log: bool,
    #[serde(default = "default_false")]
    pub review: bool,
}

fn default_true() -> bool { true }
fn default_false() -> bool { false }
fn default_refresh_interval() -> u64 { 2 }
fn default_review_tool() -> String { "codex".to_string() }
fn default_tabs() -> TabsConfig {
    TabsConfig {
        status: true,
        branch: true,
        log: true,
        review: false,
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            tabs: default_tabs(),
            refresh_interval: 2,
            mouse_enabled: true,
            auto_update_check: true,
            review_tool: default_review_tool(),
            auto_review: false,
        }
    }
}

impl Config {
    pub fn load() -> Self {
        let path = config_path();
        if let Ok(content) = fs::read_to_string(&path) {
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            Config::default()
        }
    }

    pub fn save(&self) -> Result<()> {
        let path = config_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let json = serde_json::to_string_pretty(self)?;
        fs::write(&path, json)?;
        Ok(())
    }
}

fn config_path() -> PathBuf {
    dirs_fallback().join("gitt").join("config.json")
}

fn dirs_fallback() -> PathBuf {
    if let Ok(dir) = std::env::var("XDG_CONFIG_HOME") {
        PathBuf::from(dir)
    } else if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".config")
    } else {
        PathBuf::from(".")
    }
}
