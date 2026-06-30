// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
  // Allow WebKitGTK to render at the display's native refresh rate instead of 60fps
  #[cfg(target_os = "linux")]
  {
    std::env::set_var("WEBKIT_FORCE_COMPOSITING_MODE", "1");
  }
  app_lib::run();
}
