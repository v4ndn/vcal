use tauri::Manager;
use serde::Serialize;

#[derive(Serialize)]
struct MdFile {
    relative_path: String,
    content: String,
}

fn collect_md_files(
    folder_name: &str,
    base: &std::path::Path,
    dir: &std::path::Path,
    results: &mut Vec<MdFile>,
) -> std::io::Result<()> {
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_md_files(folder_name, base, &path, results)?;
        } else if path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("md")).unwrap_or(false) {
            let rel = path.strip_prefix(base).unwrap_or(&path).to_string_lossy().replace('\\', "/");
            let relative_path = format!("{folder_name}/{rel}");
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            results.push(MdFile { relative_path, content });
        }
    }
    Ok(())
}

#[tauri::command]
async fn pick_md_folder() -> Result<Vec<MdFile>, String> {
    let handle = rfd::AsyncFileDialog::new()
        .set_title("Select folder to import")
        .pick_folder()
        .await;

    let Some(folder) = handle else {
        return Ok(vec![]);
    };

    let path = folder.path().to_path_buf();
    let folder_name = path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| "folder".to_string());

    let mut results = Vec::new();
    collect_md_files(&folder_name, &path, &path, &mut results)
        .map_err(|e| e.to_string())?;

    Ok(results)
}

#[tauri::command]
fn notify(title: String, body: String, app: tauri::AppHandle) {
  std::process::Command::new("notify-send")
    .args(["-a", "vcalendar", &title, &body])
    .spawn()
    .ok();

  let candidates: Vec<std::path::PathBuf> = vec![
    std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../notification.mp3"),
    app.path().resource_dir().unwrap_or_default().join("notification.mp3"),
  ];

  for path in candidates {
    if path.exists() {
      let played = std::process::Command::new("paplay")
        .arg(&path)
        .spawn()
        .is_ok();
      if !played {
        std::process::Command::new("aplay")
          .arg(&path)
          .spawn()
          .ok();
      }
      break;
    }
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(tauri::generate_handler![notify, pick_md_folder])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
