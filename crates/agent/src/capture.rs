use image::{imageops::FilterType, RgbImage, RgbaImage};

pub const THUMB_W: u32 = 480;

/// Chụp màn hình chính, thu nhỏ rộng THUMB_W, trả về JPEG.
pub fn capture_jpeg(fake: bool, seq: u32, label: &str) -> Result<Vec<u8>, String> {
    let rgba = if fake { fake_screen(seq, label) } else { real_screen()? };
    encode(&rgba)
}

fn encode(src: &RgbaImage) -> Result<Vec<u8>, String> {
    let (w, h) = src.dimensions();
    let tw = THUMB_W.min(w);
    let th = ((h as u64 * tw as u64) / w.max(1) as u64).max(1) as u32;
    let small = image::imageops::resize(src, tw, th, FilterType::Triangle);
    let rgb: RgbImage = image::DynamicImage::ImageRgba8(small).to_rgb8();
    let mut out = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, 55)
        .encode_image(&rgb)
        .map_err(|e| e.to_string())?;
    Ok(out)
}

/// Ảnh giả: nền màu theo nhãn + thanh chạy theo thời gian (để kiểm thử không cần màn hình).
fn fake_screen(seq: u32, label: &str) -> RgbaImage {
    let h = label.bytes().fold(7u32, |a, b| a.wrapping_mul(31).wrapping_add(b as u32));
    let (r, g, b) = ((h & 0xff) as u8 / 2 + 40, ((h >> 8) & 0xff) as u8 / 2 + 40, ((h >> 16) & 0xff) as u8 / 2 + 80);
    let (w, hgt) = (1280u32, 720u32);
    let mut img = RgbaImage::from_pixel(w, hgt, image::Rgba([r, g, b, 255]));
    let x0 = (seq * 40) % (w - 200);
    for y in 300..420 {
        for x in x0..x0 + 200 {
            img.put_pixel(x, y, image::Rgba([255, 255, 255, 255]));
        }
    }
    img
}

#[cfg(windows)]
fn real_screen() -> Result<RgbaImage, String> {
    let monitors = xcap::Monitor::all().map_err(|e| e.to_string())?;
    let m = monitors
        .iter()
        .find(|m| m.is_primary())
        .or_else(|| monitors.first())
        .ok_or("không thấy màn hình")?;
    let shot = m.capture_image().map_err(|e| e.to_string())?;
    let (w, h) = (shot.width(), shot.height());
    RgbaImage::from_raw(w, h, shot.into_raw()).ok_or_else(|| "ảnh chụp lỗi".to_string())
}

#[cfg(not(windows))]
fn real_screen() -> Result<RgbaImage, String> {
    Err("chụp màn hình thật chỉ hỗ trợ Windows; dùng --fake để thử".into())
}
