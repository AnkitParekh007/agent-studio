use futures_util::StreamExt;
use keyring::Entry;
use serde::Serialize;
use tauri::{AppHandle, Emitter};

const SERVICE: &str = "agent-studio-desktop";
const ACCOUNT: &str = "session-cookie";
const DEFAULT_API: &str = "http://localhost:4000";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_session_cookie() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
fn save_session_cookie(cookie: String) -> Result<(), String> {
    entry()?.set_password(&cookie).map_err(|e| e.to_string())
}

#[tauri::command]
fn clear_session_cookie() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

fn api_base() -> String {
    std::env::var("VITE_API_BASE_URL")
        .or_else(|_| std::env::var("API_BASE_URL"))
        .unwrap_or_else(|_| DEFAULT_API.to_string())
}

fn pick_session_cookie(set_cookies: &[String]) -> Option<String> {
    for header in set_cookies {
        let first = header.split(';').next()?.trim();
        let lower = first.to_lowercase();
        if lower.contains("session") {
            return Some(first.to_string());
        }
    }
    set_cookies
        .first()
        .and_then(|h| h.split(';').next())
        .map(|s| s.trim().to_string())
        .filter(|s| s.contains('='))
}

#[tauri::command]
async fn auth_sign_in(email: String, password: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::new();
    let res = client
        .post(format!("{}/api/auth/sign-in/email", api_base()))
        .header("content-type", "application/json")
        .header("origin", "http://localhost:1420")
        .json(&serde_json::json!({ "email": email, "password": password }))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let status = res.status();
    let set_cookies = res
        .headers()
        .get_all(reqwest::header::SET_COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok().map(|s| s.to_string()))
        .collect::<Vec<_>>();
    let body = res.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(body);
    }

    let cookie = pick_session_cookie(&set_cookies)
        .ok_or_else(|| "Sign-in succeeded but no session cookie was returned".to_string())?;
    save_session_cookie(cookie)?;

    serde_json::from_str(&body).map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct ApiResponse {
    status: u16,
    body: String,
}

#[tauri::command]
async fn api_request(
    method: String,
    path: String,
    organization_id: Option<String>,
    body: Option<String>,
    skip_auth: Option<bool>,
) -> Result<ApiResponse, String> {
    let client = reqwest::Client::new();
    let url = format!("{}{}", api_base(), path);
    let mut req = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PATCH" => client.patch(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        other => return Err(format!("Unsupported method {other}")),
    };

    if let Some(org) = organization_id {
        req = req.header("x-organization-id", org);
    }
    if !skip_auth.unwrap_or(false) {
        if let Some(cookie) = load_session_cookie()? {
            req = req.header(reqwest::header::COOKIE, cookie);
        }
    }
    if let Some(body) = body {
        req = req
            .header("content-type", "application/json")
            .body(body);
    } else if method.eq_ignore_ascii_case("POST")
        || method.eq_ignore_ascii_case("PATCH")
        || method.eq_ignore_ascii_case("PUT")
    {
        req = req
            .header("content-type", "application/json")
            .body("{}".to_string());
    }

    let res = req.send().await.map_err(|e| e.to_string())?;
    Ok(ApiResponse {
        status: res.status().as_u16(),
        body: res.text().await.map_err(|e| e.to_string())?,
    })
}

#[tauri::command]
async fn gateway_stream(
    app: AppHandle,
    session_id: String,
    organization_id: String,
) -> Result<(), String> {
    let cookie = load_session_cookie()?.ok_or_else(|| "Not signed in".to_string())?;
    let client = reqwest::Client::new();
    let res = client
        .post(format!(
            "{}/api/gateway/sessions/{}/stream",
            api_base(),
            session_id
        ))
        .header(reqwest::header::COOKIE, cookie)
        .header("x-organization-id", organization_id)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        return Err(res.text().await.unwrap_or_else(|_| "stream failed".into()));
    }

    let mut stream = res.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let bytes = chunk.map_err(|e| e.to_string())?;
        let text = String::from_utf8_lossy(&bytes).to_string();
        app.emit("gateway-stream-chunk", text)
            .map_err(|e| e.to_string())?;
    }
    app.emit("gateway-stream-done", true)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            load_session_cookie,
            save_session_cookie,
            clear_session_cookie,
            auth_sign_in,
            api_request,
            gateway_stream
        ])
        .run(tauri::generate_context!())
        .expect("error while running Agent Studio desktop shell");
}
