package expo.modules.pdfpageimage

import android.app.Service
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.os.Binder
import android.os.IBinder
import android.os.Parcel
import android.os.ParcelFileDescriptor
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.roundToInt
import kotlin.math.sqrt

/**
 * Runs every `android.graphics.pdf.PdfRenderer` call in the separate `:pdfrender` process
 * (declared in this module's AndroidManifest.xml), never in the app process.
 *
 * PdfRenderer is a thin wrapper over the system's native pdfium. On real devices pdfium
 * segfaults on some malformed, truncated or hostile PDFs (Play Console:
 * `CPDF_Document::CPDF_Document` and `CPDF_Page::~CPDF_Page` SIGSEGVs). A native crash can't be
 * caught, so in-process it took the whole app down, often from a thumbnail of a file the user
 * never opened. Here it only kills this helper process: [PdfRenderClient] sees a dead binder and
 * reports a normal "could not read this PDF" error, and the next call starts a fresh process.
 * See ADR 0011.
 *
 * Binder calls arrive on a pool of binder threads, and pdfium is not thread-safe (the
 * framework only added its own lock in API 26, and minSdk is 24), so every pdfium call here
 * holds [pdfiumLock].
 */
class PdfRenderService : Service() {
  private val pdfiumLock = Any()

  private val binder = object : Binder() {
    override fun onTransact(code: Int, data: Parcel, reply: Parcel?, flags: Int): Boolean {
      return when (code) {
        PdfRenderProtocol.TRANSACTION_PAGE_COUNT -> {
          data.enforceInterface(PdfRenderProtocol.DESCRIPTOR)
          val pfd = data.readFileDescriptor()
          reply?.let { pageCount(pfd, it) }
          true
        }
        PdfRenderProtocol.TRANSACTION_RENDER -> {
          data.enforceInterface(PdfRenderProtocol.DESCRIPTOR)
          val pfd = data.readFileDescriptor()
          val pageIndex = data.readInt()
          val scale = data.readDouble()
          val maxPixels = data.readLong()
          val outputPath = data.readString() ?: ""
          reply?.let { render(pfd, pageIndex, scale, maxPixels, File(outputPath), it) }
          true
        }
        else -> super.onTransact(code, data, reply, flags)
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder = binder

  private fun pageCount(pfd: ParcelFileDescriptor?, reply: Parcel) {
    val renderer = openOrReply(pfd, reply) ?: return
    try {
      val count = synchronized(pdfiumLock) { renderer.use { it.pageCount } }
      reply.writeInt(PdfRenderProtocol.STATUS_OK)
      reply.writeInt(count)
    } catch (e: Throwable) {
      reply.writeInt(PdfRenderProtocol.STATUS_OPEN_FAILED)
      reply.writeString(e.message ?: e.javaClass.simpleName)
    }
  }

  /**
   * Rasterizes one page to a JPEG at [outputFile].
   *
   * @param scale Requested output px per PDF point (unitless).
   * @param maxPixels Upper bound on the bitmap's width * height, in px. A page whose requested
   *   size exceeds it is rendered at a lower scale instead, so a poster-sized page can't ask for
   *   hundreds of MB. The reply carries the page's real size in pt so callers never have to
   *   derive it from px / scale.
   */
  private fun render(
    pfd: ParcelFileDescriptor?,
    pageIndex: Int,
    scale: Double,
    maxPixels: Long,
    outputFile: File,
    reply: Parcel
  ) {
    val renderer = openOrReply(pfd, reply) ?: return
    var bitmap: Bitmap? = null
    try {
      synchronized(pdfiumLock) {
        renderer.use {
          if (pageIndex < 0 || pageIndex >= renderer.pageCount) {
            reply.writeInt(PdfRenderProtocol.STATUS_PAGE_NOT_FOUND)
            reply.writeInt(renderer.pageCount)
            return
          }
          renderer.openPage(pageIndex).use { page ->
            // page.width / page.height are in PDF points (1/72"), the unit coordinateMath.ts
            // uses elsewhere in this app - see hindi-pdf-editor-spec.md Section 7-8.
            val widthPt = max(page.width, 1)
            val heightPt = max(page.height, 1)
            val requestedPixels = widthPt.toDouble() * scale * heightPt.toDouble() * scale
            val effectiveScale = if (requestedPixels > maxPixels) {
              scale * sqrt(maxPixels / requestedPixels)
            } else {
              scale
            }
            val pxWidth = (widthPt * effectiveScale).roundToInt().coerceAtLeast(1)
            val pxHeight = (heightPt * effectiveScale).roundToInt().coerceAtLeast(1)

            val pageBitmap = Bitmap.createBitmap(pxWidth, pxHeight, Bitmap.Config.ARGB_8888)
            bitmap = pageBitmap
            // PDF pages with transparent regions would otherwise composite onto a black
            // bitmap by default; white matches what every PDF viewer shows for those regions.
            pageBitmap.eraseColor(Color.WHITE)
            val matrix = Matrix().apply {
              setScale(pxWidth / widthPt.toFloat(), pxHeight / heightPt.toFloat())
            }
            page.render(pageBitmap, null, matrix, PdfRenderer.Page.RENDER_MODE_FOR_PRINT)

            // JPEG, not PNG: confirmed on a real device that Android's print WebView hangs
            // indefinitely (not just "slow") when a page background this size is
            // base64-inlined as a PNG `background-image` data URI *and* the overlay text needs
            // real Devanagari shaping through the same embedded variable font (see CHANGELOG).
            // This bitmap has no meaningful alpha (erased to opaque white above), so JPEG loses
            // nothing. Quality 97 plus the caller's 3x render scale keeps fine source text close
            // to the original, and per-page WebView export keeps the payload bounded.
            FileOutputStream(outputFile).use { out ->
              check(pageBitmap.compress(Bitmap.CompressFormat.JPEG, 97, out)) {
                "Bitmap.compress returned false"
              }
            }
            reply.writeInt(PdfRenderProtocol.STATUS_OK)
            reply.writeInt(pxWidth)
            reply.writeInt(pxHeight)
            reply.writeInt(widthPt)
            reply.writeInt(heightPt)
          }
        }
      }
    } catch (e: Throwable) {
      // Throwable, not Exception: an OutOfMemoryError from createBitmap must become an error
      // reply, not a crash of this process that the client would misreport as a bad PDF.
      outputFile.delete()
      reply.writeInt(PdfRenderProtocol.STATUS_RENDER_FAILED)
      reply.writeString(e.message ?: e.javaClass.simpleName)
    } finally {
      bitmap?.recycle()
    }
  }

  /** Opens [pfd] with PdfRenderer (which then owns and closes it), or writes an error reply. */
  private fun openOrReply(pfd: ParcelFileDescriptor?, reply: Parcel): PdfRenderer? {
    if (pfd == null) {
      reply.writeInt(PdfRenderProtocol.STATUS_OPEN_FAILED)
      reply.writeString("no file descriptor")
      return null
    }
    return try {
      synchronized(pdfiumLock) { PdfRenderer(pfd) }
    } catch (e: Throwable) {
      try {
        pfd.close()
      } catch (_: Exception) {
      }
      reply.writeInt(PdfRenderProtocol.STATUS_OPEN_FAILED)
      reply.writeString(e.message ?: e.javaClass.simpleName)
      null
    }
  }
}
