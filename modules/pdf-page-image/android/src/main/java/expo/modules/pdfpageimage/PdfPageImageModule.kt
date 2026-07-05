package expo.modules.pdfpageimage

import android.content.Context
import android.graphics.Bitmap
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
 * This only rasterizes an existing PDF page to a background PNG image - it never draws
 * Devanagari text itself, so it doesn't touch the non-negotiable rendering rule in AGENTS.md.
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
        page.render(bitmap, null, matrix, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)

        val outputFile = File(appContext.cacheDirectory, "pdf-page-image-${UUID.randomUUID()}.png")
        FileOutputStream(outputFile).use { out ->
          bitmap.compress(Bitmap.CompressFormat.PNG, 100, out)
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
}
