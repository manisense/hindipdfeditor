package expo.modules.pdfpageimage

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

/**
 * In-house replacement for the third-party `react-native-pdf-page-image` package (see
 * hindi-pdf-editor-spec.md Section 4.2 / ADR 0004): that package's own Android build script
 * pins an isolated, unmaintained Android Gradle Plugin version that fails to resolve under
 * this project's Gradle/JDK toolchain. This module wraps the stable, first-party
 * `android.graphics.pdf.PdfRenderer` API directly, with no third-party dependency.
 *
 * This rasterizes an existing PDF page to a background JPEG image, and separately samples
 * average pixel colors from an already-rendered background image (for Phase 3 masking) - it
 * never draws Devanagari text itself, so it doesn't touch the non-negotiable rendering rule
 * in AGENTS.md.
 */
class PdfPageImageModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("PdfPageImage")

    AsyncFunction("getPageCount") { uri: String ->
      openRenderer(uri).use { renderer -> renderer.pageCount }
    }

    // scale is unitless (output px per PDF point) - callers pass 2-3x per
    // hindi-pdf-editor-spec.md's performance constraint (Section 4.1/AGENTS.md), not
    // an arbitrarily higher number.
    AsyncFunction("renderPage") { uri: String, page: Int, scale: Double ->
      renderPage(uri, page, scale)
    }

    // All Int params are background-image px (the same space PageState.imagePxWidth/Height and
    // htmlCompositor.ts's layers live in), not PDF points - see coordinateMath.ts's
    // ptSizeToImagePx, which callers use to convert a MaskEdit's stored pt rectangle before
    // calling this. Phase 3 (spec Section 10): lets the caller pick a mask fill color that
    // matches the page instead of a hardcoded white/gray.
    AsyncFunction("sampleAverageColor") {
        uri: String,
        xPx: Int,
        yPx: Int,
        wPx: Int,
        hPx: Int,
        marginPx: Int ->
      sampleAverageColor(uri, xPx, yPx, wPx, hPx, marginPx)
    }

    // Samples the dominant ink color *inside* a text bounding box (OCR line rect), in
    // background-image px - the complement of sampleAverageColor, which reads the surrounding
    // paper color for mask fills.
    AsyncFunction("sampleTextColor") { uri: String, xPx: Int, yPx: Int, wPx: Int, hPx: Int ->
      sampleTextColor(uri, xPx, yPx, wPx, hPx)
    }
  }

  private fun openParcelFileDescriptor(uriString: String): ParcelFileDescriptor {
    val uri = Uri.parse(uriString)
    return if (uri.scheme == "content") {
      context.contentResolver.openFileDescriptor(uri, "r")
        ?: throw IllegalStateException("contentResolver.openFileDescriptor returned null")
    } else {
      // Plain absolute path, or a file:// URI - Uri.path strips the scheme for us either way.
      val path = uri.path ?: uriString
      ParcelFileDescriptor.open(File(path), ParcelFileDescriptor.MODE_READ_ONLY)
    }
  }

  private fun openRenderer(uriString: String): PdfRenderer {
    val pfd = try {
      openParcelFileDescriptor(uriString)
    } catch (e: Exception) {
      throw PdfOpenFailedException(uriString, e)
    }
    return try {
      // PdfRenderer takes ownership of pfd and closes it when the renderer is closed,
      // including via the `.use {}` extension below - do not close pfd separately after this.
      PdfRenderer(pfd)
    } catch (e: Exception) {
      pfd.close()
      throw PdfOpenFailedException(uriString, e)
    }
  }

  private fun renderPage(uriString: String, pageIndex: Int, scale: Double): PageImageResult {
    openRenderer(uriString).use { renderer ->
      if (pageIndex < 0 || pageIndex >= renderer.pageCount) {
        throw PdfPageNotFoundException(pageIndex, renderer.pageCount)
      }

      renderer.openPage(pageIndex).use { page ->
        // page.width / page.height are in PDF points (1/72"), matching the unit
        // coordinateMath.ts uses elsewhere in this app - see hindi-pdf-editor-spec.md Section 7-8.
        val pxWidth = Math.round(page.width * scale).toInt().coerceAtLeast(1)
        val pxHeight = Math.round(page.height * scale).toInt().coerceAtLeast(1)

        val bitmap = Bitmap.createBitmap(pxWidth, pxHeight, Bitmap.Config.ARGB_8888)
        // PDF pages with transparent regions would otherwise composite onto a black
        // bitmap by default; white matches what every PDF viewer shows for those regions.
        bitmap.eraseColor(Color.WHITE)

        val matrix = Matrix().apply {
          setScale(pxWidth / page.width.toFloat(), pxHeight / page.height.toFloat())
        }
        page.render(bitmap, null, matrix, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)

        // JPEG, not PNG: confirmed on a real device that Android's print WebView hangs
        // indefinitely (not just "slow") when a page background this size is base64-inlined as
        // a PNG `background-image` data URI *and* the overlay text needs real Devanagari shaping
        // through the same embedded variable font - PNG-only text/whitespace-heavy content with
        // no overlay text, and small ASCII overlay text, both exported fine, isolating the
        // combination rather than either factor alone (see CHANGELOG). This bitmap already has
        // no meaningful alpha (erased to opaque white above for transparent PDF regions), so
        // JPEG's lack of an alpha channel loses nothing. Quality 97 plus the caller's 3x render
        // scale keeps fine source text materially closer to the original while per-page WebView
        // export prevents the larger image from accumulating into one multi-page HTML payload.
        val outputFile = File(appContext.cacheDirectory, "pdf-page-image-${UUID.randomUUID()}.jpg")
        FileOutputStream(outputFile).use { out ->
          bitmap.compress(Bitmap.CompressFormat.JPEG, 97, out)
        }
        bitmap.recycle()

        return PageImageResult(
          uri = Uri.fromFile(outputFile).toString(),
          width = pxWidth,
          height = pxHeight
        )
      }
    }
  }

  /**
   * Finds the per-channel *median* (not mean) of the pixels in a band `marginPx` wide
   * surrounding (xPx, yPx, wPx, hPx), excluding the rectangle itself, to approximate the page's
   * background color right around a region the user is about to mask - not the color of the
   * burned-in text inside the rectangle, which is exactly what masking is trying to hide.
   *
   * Median over mean: callers (`App.tsx`) already expand the caller-drawn rectangle by a small
   * safety margin before calling this, specifically so the sampled band starts past the
   * anti-aliased edge of the original text - but real documents still put JPEG ringing
   * artifacts and the occasional stray dark pixel right at that boundary. A mean lets even a
   * handful of such outliers visibly drag the fill color away from the true paper color (this
   * was reported as "the mask box is still visible" against non-pure-white backgrounds); a
   * median is unaffected by a minority of outliers as long as most of the sampled band is
   * genuinely background, which it is by construction here.
   *
   * Decodes the whole background JPEG rather than only the needed band via
   * `BitmapRegionDecoder`: these images are already bounded to 2-3x a page's point-dimensions
   * per AGENTS.md's performance constraint (a few MB decoded), and this runs once per
   * user-drawn mask, not in a hot loop, so the simpler full-decode is preferable.
   */
  private fun sampleAverageColor(
    uriString: String,
    xPx: Int,
    yPx: Int,
    wPx: Int,
    hPx: Int,
    marginPx: Int
  ): String {
    val pfd = try {
      openParcelFileDescriptor(uriString)
    } catch (e: Exception) {
      throw ColorSampleFailedException(uriString, e)
    }
    val bitmap = try {
      pfd.use { BitmapFactory.decodeFileDescriptor(it.fileDescriptor) }
        ?: throw IllegalStateException("BitmapFactory.decodeFileDescriptor returned null")
    } catch (e: Exception) {
      throw ColorSampleFailedException(uriString, e)
    }

    try {
      val outerLeft = (xPx - marginPx).coerceIn(0, bitmap.width)
      val outerTop = (yPx - marginPx).coerceIn(0, bitmap.height)
      val outerRight = (xPx + wPx + marginPx).coerceIn(0, bitmap.width)
      val outerBottom = (yPx + hPx + marginPx).coerceIn(0, bitmap.height)
      val innerLeft = xPx.coerceIn(0, bitmap.width)
      val innerTop = yPx.coerceIn(0, bitmap.height)
      val innerRight = (xPx + wPx).coerceIn(0, bitmap.width)
      val innerBottom = (yPx + hPx).coerceIn(0, bitmap.height)

      // Fixed-size (0-255) histograms, not a full pixel list - O(1) extra space per channel
      // regardless of how large the sampled band is, while still supporting an exact median.
      val histR = IntArray(256)
      val histG = IntArray(256)
      val histB = IntArray(256)
      var count = 0L
      for (y in outerTop until outerBottom) {
        val insideInnerRow = y in innerTop until innerBottom
        for (x in outerLeft until outerRight) {
          if (insideInnerRow && x in innerLeft until innerRight) continue
          val pixel = bitmap.getPixel(x, y)
          histR[Color.red(pixel)]++
          histG[Color.green(pixel)]++
          histB[Color.blue(pixel)]++
          count++
        }
      }

      // Degenerate case (e.g. the rectangle fills the whole page, leaving no surrounding band
      // to sample) - fail closed to white, the most common real-world page background, rather
      // than divide by zero or crash.
      if (count == 0L) return "#ffffff"

      fun medianOf(histogram: IntArray): Int {
        val half = count / 2
        var runningCount = 0L
        for (value in 0..255) {
          runningCount += histogram[value]
          if (runningCount > half) return value
        }
        return 255
      }

      return String.format(
        "#%02x%02x%02x",
        medianOf(histR),
        medianOf(histG),
        medianOf(histB)
      )
    } finally {
      bitmap.recycle()
    }
  }

  /**
   * Approximates the burned-in text color inside an OCR-detected line box by taking a low
   * luminance percentile of the inner pixels (text ink is usually among the darkest pixels on
   * a light page). Insets the sample region slightly so anti-aliased box edges don't dominate.
   */
  private fun sampleTextColor(
    uriString: String,
    xPx: Int,
    yPx: Int,
    wPx: Int,
    hPx: Int
  ): String {
    val pfd = try {
      openParcelFileDescriptor(uriString)
    } catch (e: Exception) {
      throw ColorSampleFailedException(uriString, e)
    }
    val bitmap = try {
      pfd.use { BitmapFactory.decodeFileDescriptor(it.fileDescriptor) }
        ?: throw IllegalStateException("BitmapFactory.decodeFileDescriptor returned null")
    } catch (e: Exception) {
      throw ColorSampleFailedException(uriString, e)
    }

    try {
      val insetX = (wPx * 0.12).toInt().coerceAtMost(wPx / 2)
      val insetY = (hPx * 0.12).toInt().coerceAtMost(hPx / 2)
      val left = (xPx + insetX).coerceIn(0, bitmap.width)
      val top = (yPx + insetY).coerceIn(0, bitmap.height)
      val right = (xPx + wPx - insetX).coerceIn(0, bitmap.width)
      val bottom = (yPx + hPx - insetY).coerceIn(0, bitmap.height)
      if (right <= left || bottom <= top) return "#111111"

      val luminances = ArrayList<Pair<Double, Int>>()
      for (y in top until bottom) {
        for (x in left until right) {
          val pixel = bitmap.getPixel(x, y)
          val lum =
            Color.red(pixel) * 0.299 + Color.green(pixel) * 0.587 + Color.blue(pixel) * 0.114
          luminances.add(lum to pixel)
        }
      }
      if (luminances.isEmpty()) return "#111111"

      luminances.sortBy { it.first }
      val idx = (luminances.size * 0.12).toInt().coerceIn(0, luminances.size - 1)
      val pixel = luminances[idx].second
      return String.format("#%02x%02x%02x", Color.red(pixel), Color.green(pixel), Color.blue(pixel))
    } finally {
      bitmap.recycle()
    }
  }
}
