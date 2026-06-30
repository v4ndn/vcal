use tauri::Manager;

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
    .invoke_handler(tauri::generate_handler![notify])
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
