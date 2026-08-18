package expo.modules.pdfpageimage

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import android.provider.Settings
import androidx.core.content.ContextCompat
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

    // Checks if the app has broad device storage permission
    AsyncFunction("hasStoragePermission") {
      hasStoragePermission()
    }

    // Requests device storage permission or opens Android All Files Access settings
    AsyncFunction("requestStoragePermission") {
      requestStoragePermission()
    }

    // Scans device MediaStore storage for all PDF documents on the device.
    AsyncFunction("scanDevicePdfFiles") {
      scanDevicePdfFiles()
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
        val outputFile = File(appContext.cacheDirectory, "pdf-page-image-${UUID.randomUUID()}.jpg")
        try {
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
          FileOutputStream(outputFile).use { out ->
            check(bitmap.compress(Bitmap.CompressFormat.JPEG, 97, out)) {
              "Bitmap.compress returned false"
            }
          }
        } catch (e: Exception) {
          outputFile.delete()
          throw e
        } finally {
          bitmap.recycle()
        }

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
   * Estimates the dominant ink/text color inside an OCR-detected line box by finding the color
   * cluster with maximum contrast from the background paper color.
   *
   * Unlike luminance-only percentiles (which fail on light text over dark/colored backgrounds
   * by picking the darker background color instead of the text ink), this:
   * 1. Determines the background color using channel medians across the box.
   * 2. Measures Manhattan color distance |r - bgR| + |g - bgG| + |b - bgB| for every pixel.
   * 3. Averages the highest-contrast pixels (top distance buckets) to accurately extract the text color.
   * 4. Supports light-on-dark, dark-on-light, and colored text over colored backgrounds.
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
      val insetX = (wPx * 0.08).toInt().coerceAtMost(wPx / 4)
      val insetY = (hPx * 0.08).toInt().coerceAtMost(hPx / 4)
      val left = (xPx + insetX).coerceIn(0, bitmap.width)
      val top = (yPx + insetY).coerceIn(0, bitmap.height)
      val right = (xPx + wPx - insetX).coerceIn(0, bitmap.width)
      val bottom = (yPx + hPx - insetY).coerceIn(0, bitmap.height)
      if (right <= left || bottom <= top) return "#15172c"

      val histR = IntArray(256)
      val histG = IntArray(256)
      val histB = IntArray(256)
      var totalPixels = 0L

      // Step 1: Collect channel histograms to find the background color (median of each channel)
      for (y in top until bottom) {
        for (x in left until right) {
          val pixel = bitmap.getPixel(x, y)
          histR[Color.red(pixel)]++
          histG[Color.green(pixel)]++
          histB[Color.blue(pixel)]++
          totalPixels++
        }
      }
      if (totalPixels == 0L) return "#15172c"

      fun medianOf(histogram: IntArray): Int {
        val half = totalPixels / 2
        var runningCount = 0L
        for (value in 0..255) {
          runningCount += histogram[value]
          if (runningCount > half) return value
        }
        return 255
      }

      val bgR = medianOf(histR)
      val bgG = medianOf(histG)
      val bgB = medianOf(histB)

      // Step 2: Measure distance from background for all pixels
      val distCounts = LongArray(766)
      val distRedSums = LongArray(766)
      val distGreenSums = LongArray(766)
      val distBlueSums = LongArray(766)
      var maxDist = 0

      for (y in top until bottom) {
        for (x in left until right) {
          val pixel = bitmap.getPixel(x, y)
          val r = Color.red(pixel)
          val g = Color.green(pixel)
          val b = Color.blue(pixel)
          val dist = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB)
          distCounts[dist]++
          distRedSums[dist] += r.toLong()
          distGreenSums[dist] += g.toLong()
          distBlueSums[dist] += b.toLong()
          if (dist > maxDist) {
            maxDist = dist
          }
        }
      }

      // If there is very little contrast in the region (< 35 total delta), fallback
      // based on the background brightness so text is always legible.
      if (maxDist < 35) {
        val bgLuma = (bgR * 299 + bgG * 587 + bgB * 114) / 1000
        return if (bgLuma > 128) "#15172c" else "#ffffff"
      }

      // Step 3: Accumulate the highest-contrast pixels (top distance buckets)
      val targetSampleCount = Math.max(10L, (totalPixels * 8 / 100))
      var accumulatedCount = 0L
      var sumR = 0L
      var sumG = 0L
      var sumB = 0L
      val minDistanceThreshold = (maxDist * 40 / 100).coerceAtLeast(25)

      for (d in 765 downTo minDistanceThreshold) {
        val count = distCounts[d]
        if (count > 0) {
          accumulatedCount += count
          sumR += distRedSums[d]
          sumG += distGreenSums[d]
          sumB += distBlueSums[d]
          if (accumulatedCount >= targetSampleCount) {
            break
          }
        }
      }

      if (accumulatedCount == 0L) {
        val bgLuma = (bgR * 299 + bgG * 587 + bgB * 114) / 1000
        return if (bgLuma > 128) "#15172c" else "#ffffff"
      }

      val finalR = (sumR / accumulatedCount).toInt().coerceIn(0, 255)
      val finalG = (sumG / accumulatedCount).toInt().coerceIn(0, 255)
      val finalB = (sumB / accumulatedCount).toInt().coerceIn(0, 255)

      return String.format("#%02x%02x%02x", finalR, finalG, finalB)
    } finally {
      bitmap.recycle()
    }
  }

  /**
   * Comprehensive device PDF scanner querying both Android MediaStore and storage folders.
   */
  private fun scanDevicePdfFiles(): List<Map<String, Any>> {
    val results = mutableListOf<Map<String, Any>>()
    val seenKeys = mutableSetOf<String>()

    fun addFileResult(
      name: String,
      uriStr: String,
      sizeBytes: Long,
      dateModified: Long,
      folder: String?,
      filePath: String?,
      key: String
    ) {
      if (seenKeys.add(key)) {
        val map = mutableMapOf<String, Any>(
          "name" to name,
          "uri" to uriStr,
          "sizeBytes" to sizeBytes,
          "dateModified" to dateModified
        )
        if (!folder.isNullOrBlank()) {
          map["folder"] = folder
        }
        if (!filePath.isNullOrBlank()) {
          map["path"] = filePath
        }
        results.add(map)
      }
    }

    fun queryMediaStoreUri(queryUri: Uri) {
      try {
        val projection = arrayOf(
          MediaStore.Files.FileColumns._ID,
          MediaStore.Files.FileColumns.DISPLAY_NAME,
          MediaStore.Files.FileColumns.SIZE,
          MediaStore.Files.FileColumns.DATE_MODIFIED,
          MediaStore.Files.FileColumns.DATA,
          MediaStore.Files.FileColumns.BUCKET_DISPLAY_NAME
        )
        val selection = "${MediaStore.Files.FileColumns.MIME_TYPE} = ? OR ${MediaStore.Files.FileColumns.MIME_TYPE} = ? OR ${MediaStore.Files.FileColumns.DISPLAY_NAME} LIKE ?"
        val selectionArgs = arrayOf("application/pdf", "application/x-pdf", "%.pdf")
        val sortOrder = "${MediaStore.Files.FileColumns.DATE_MODIFIED} DESC"

        context.contentResolver.query(queryUri, projection, selection, selectionArgs, sortOrder)?.use { cursor ->
          val idCol = cursor.getColumnIndex(MediaStore.Files.FileColumns._ID)
          val nameCol = cursor.getColumnIndex(MediaStore.Files.FileColumns.DISPLAY_NAME)
          val sizeCol = cursor.getColumnIndex(MediaStore.Files.FileColumns.SIZE)
          val dateCol = cursor.getColumnIndex(MediaStore.Files.FileColumns.DATE_MODIFIED)
          val dataCol = cursor.getColumnIndex(MediaStore.Files.FileColumns.DATA)
          val bucketCol = cursor.getColumnIndex(MediaStore.Files.FileColumns.BUCKET_DISPLAY_NAME)

          while (cursor.moveToNext()) {
            val id = if (idCol >= 0) cursor.getLong(idCol) else -1L
            val name = if (nameCol >= 0) (cursor.getString(nameCol) ?: "Document.pdf") else "Document.pdf"
            val size = if (sizeCol >= 0) cursor.getLong(sizeCol) else 0L
            val dateModified = if (dateCol >= 0) cursor.getLong(dateCol) else 0L
            val filePath = if (dataCol >= 0) cursor.getString(dataCol) else null
            val bucketName = if (bucketCol >= 0) cursor.getString(bucketCol) else null

            val uriStr = if (filePath != null && File(filePath).exists()) {
              Uri.fromFile(File(filePath)).toString()
            } else if (id >= 0) {
              ContentUris.withAppendedId(queryUri, id).toString()
            } else null

            val inferredFolder = bucketName ?: (if (filePath != null) File(filePath).parentFile?.name else null)

            if (uriStr != null) {
              val key = filePath ?: "$name-$size"
              addFileResult(
                name = name,
                uriStr = uriStr,
                sizeBytes = size,
                dateModified = dateModified,
                folder = inferredFolder,
                filePath = filePath,
                key = key
              )
            }
          }
        }
      } catch (e: Exception) {
        // ignore
      }
    }

    // 1. Query MediaStore Files
    queryMediaStoreUri(MediaStore.Files.getContentUri("external"))

    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
      try {
        queryMediaStoreUri(MediaStore.Downloads.EXTERNAL_CONTENT_URI)
      } catch (e: Exception) {
        // ignore
      }
    }

    // 2. Scan standard device public and app-accessible storage directories
    val scanDirs = mutableListOf<File>()
    try {
      Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)?.let { scanDirs.add(it) }
      Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS)?.let { scanDirs.add(it) }
      scanDirs.add(File("/storage/emulated/0/Download"))
      scanDirs.add(File("/storage/emulated/0/Documents"))
      scanDirs.add(File("/storage/emulated/0/Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Documents"))
      scanDirs.add(File("/storage/emulated/0/WhatsApp/Media/WhatsApp Documents"))
      scanDirs.add(File("/storage/emulated/0/Telegram/Telegram Documents"))
      scanDirs.add(File("/storage/emulated/0/CamScanner"))
      scanDirs.add(File("/storage/emulated/0/Adobe Acrobat"))
      scanDirs.add(File("/storage/emulated/0/Bluetooth"))
      scanDirs.add(File("/storage/emulated/0/DCIM"))
      context.getExternalFilesDirs(null).forEach { if (it != null) scanDirs.add(it) }
    } catch (e: Exception) {
      // ignore
    }

    fun crawlDir(dir: File, depth: Int) {
      if (depth > 4 || !dir.exists() || !dir.isDirectory || !dir.canRead()) return
      val list = dir.listFiles() ?: return
      for (file in list) {
        if (file.isDirectory && !file.name.startsWith(".")) {
          crawlDir(file, depth + 1)
        } else if (file.isFile && file.name.endsWith(".pdf", ignoreCase = true) && file.length() > 0) {
          addFileResult(
            name = file.name,
            uriStr = Uri.fromFile(file).toString(),
            sizeBytes = file.length(),
            dateModified = file.lastModified() / 1000,
            folder = file.parentFile?.name,
            filePath = file.absolutePath,
            key = file.absolutePath
          )
        }
      }
    }

    for (dir in scanDirs) {
      try {
        crawlDir(dir, 0)
      } catch (e: Exception) {
        // ignore
      }
    }

    return results
  }

  private fun hasStoragePermission(): Boolean {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      Environment.isExternalStorageManager()
    } else {
      ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.READ_EXTERNAL_STORAGE
      ) == PackageManager.PERMISSION_GRANTED
    }
  }

  private fun requestStoragePermission(): Boolean {
    val activity = appContext.currentActivity
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      if (Environment.isExternalStorageManager()) {
        true
      } else {
        try {
          val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
            data = Uri.parse("package:${context.packageName}")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          context.startActivity(intent)
          false
        } catch (e: Exception) {
          try {
            val genericIntent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION).apply {
              addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(genericIntent)
            false
          } catch (e2: Exception) {
            false
          }
        }
      }
    } else {
      val isGranted = ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.READ_EXTERNAL_STORAGE
      ) == PackageManager.PERMISSION_GRANTED
      if (!isGranted && activity != null) {
        activity.requestPermissions(
          arrayOf(
            Manifest.permission.READ_EXTERNAL_STORAGE,
            Manifest.permission.WRITE_EXTERNAL_STORAGE
          ),
          1001
        )
      }
      isGranted
    }
  }
}
