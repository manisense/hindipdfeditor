package expo.modules.pdfpageimage

import android.Manifest
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.BitmapRegionDecoder
import android.graphics.Color
import android.graphics.Rect
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
import java.util.UUID

/**
 * In-house replacement for the third-party `react-native-pdf-page-image` package (see
 * hindi-pdf-editor-spec.md Section 4.2 / ADR 0004): that package's own Android build script
 * pins an isolated, unmaintained Android Gradle Plugin version that fails to resolve under
 * this project's Gradle/JDK toolchain. This module wraps the stable, first-party
 * `android.graphics.pdf.PdfRenderer` API directly, with no third-party dependency.
 *
 * Rasterizing runs in the `:pdfrender` helper process via [PdfRenderClient]/[PdfRenderService]
 * (ADR 0011), so a pdfium crash on a bad file can't take the app down.
 *
 * This rasterizes an existing PDF page to a background JPEG image, and separately samples
 * average pixel colors from an already-rendered background image (for Phase 3 masking) - it
 * never draws Devanagari text itself, so it doesn't touch the non-negotiable rendering rule
 * in AGENTS.md.
 */
class PdfPageImageModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val renderClient: PdfRenderClient by lazy { PdfRenderClient(context.applicationContext) }

  override fun definition() = ModuleDefinition {
    Name("PdfPageImage")

    AsyncFunction("getPageCount") { uri: String ->
      pageCount(uri)
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

  // Page cap in px (width * height). 3x an A4 or US Letter page is ~4.5M px; this leaves room
  // for large pages at full scale while keeping one ARGB bitmap under ~64 MB. Bigger pages are
  // rendered at a proportionally lower scale by PdfRenderService.
  private val maxRenderPixels = 16_000_000L

  private fun openSource(uriString: String): ParcelFileDescriptor = try {
    openParcelFileDescriptor(uriString)
  } catch (e: Exception) {
    throw PdfOpenFailedException(uriString, e)
  }

  private fun pageCount(uriString: String): Int =
    openSource(uriString).use { pfd -> renderClient.pageCount(pfd, uriString) }

  private fun renderPage(uriString: String, pageIndex: Int, scale: Double): PageImageResult {
    val outputFile = File(appContext.cacheDirectory, "pdf-page-image-${UUID.randomUUID()}.jpg")
    try {
      val rendered = openSource(uriString).use { pfd ->
        renderClient.renderPage(pfd, uriString, pageIndex, scale, maxRenderPixels, outputFile)
      }
      return PageImageResult(
        uri = Uri.fromFile(outputFile).toString(),
        width = rendered.pxWidth,
        height = rendered.pxHeight,
        widthPt = rendered.widthPt,
        heightPt = rendered.heightPt
      )
    } catch (e: Exception) {
      outputFile.delete()
      throw e
    }
  }

  /**
   * Pixels of one rectangle of a JPEG this app rendered, decoded on their own via
   * `BitmapRegionDecoder` rather than decoding the whole 3x page (~18 MB for A4) for a box a few
   * hundred px across. [left]/[top] are the region's position in the full image, in px.
   */
  private class Region(
    val pixels: IntArray,
    val left: Int,
    val top: Int,
    val width: Int,
    val height: Int
  ) {
    val right get() = left + width
    val bottom get() = top + height

    /** ARGB pixel at full-image coordinates ([x], [y]) px, which must lie inside this region. */
    fun pixel(x: Int, y: Int): Int = pixels[(y - top) * width + (x - left)]
  }

  /**
   * Decodes the part of the image at [uriString] inside the given full-image px rectangle,
   * clamped to the image's bounds. Returns null when nothing of the rectangle is on the image.
   */
  private fun decodeRegion(uriString: String, left: Int, top: Int, right: Int, bottom: Int): Region? {
    val pfd = try {
      openParcelFileDescriptor(uriString)
    } catch (e: Exception) {
      throw ColorSampleFailedException(uriString, e)
    }
    return try {
      pfd.use {
        val decoder = (
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            BitmapRegionDecoder.newInstance(it)
          } else {
            @Suppress("DEPRECATION")
            BitmapRegionDecoder.newInstance(it.fileDescriptor, false)
          }
          ) ?: throw IllegalStateException("BitmapRegionDecoder.newInstance returned null")
        try {
          val rect = Rect(
            left.coerceIn(0, decoder.width),
            top.coerceIn(0, decoder.height),
            right.coerceIn(0, decoder.width),
            bottom.coerceIn(0, decoder.height)
          )
          if (rect.isEmpty) return null
          val bitmap = decoder.decodeRegion(rect, null)
            ?: throw IllegalStateException("BitmapRegionDecoder.decodeRegion returned null")
          try {
            val pixels = IntArray(bitmap.width * bitmap.height)
            bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
            Region(pixels, rect.left, rect.top, bitmap.width, bitmap.height)
          } finally {
            bitmap.recycle()
          }
        } finally {
          decoder.recycle()
        }
      }
    } catch (e: Exception) {
      throw ColorSampleFailedException(uriString, e)
    }
  }

  /**
   * Finds the per-channel *median* (not mean) of the pixels in a band `marginPx` wide
   * surrounding (xPx, yPx, wPx, hPx), excluding the rectangle itself, to approximate the page's
   * background color right around a region the user is about to mask - not the color of the
   * burned-in text inside the rectangle, which is exactly what masking is trying to hide.
   *
   * Median over mean: callers already expand the caller-drawn rectangle by a small safety
   * margin before calling this, specifically so the sampled band starts past the anti-aliased
   * edge of the original text - but real documents still put JPEG ringing artifacts and the
   * occasional stray dark pixel right at that boundary. A mean lets even a handful of such
   * outliers visibly drag the fill color away from the true paper color (this was reported as
   * "the mask box is still visible" against non-pure-white backgrounds); a median is
   * unaffected by a minority of outliers as long as most of the sampled band is genuinely
   * background, which it is by construction here.
   *
   * All parameters are background-image px.
   */
  private fun sampleAverageColor(
    uriString: String,
    xPx: Int,
    yPx: Int,
    wPx: Int,
    hPx: Int,
    marginPx: Int
  ): String {
    // Degenerate case (nothing of the band is on the image) - fail closed to white, the most
    // common real-world page background, rather than divide by zero or crash.
    val region = decodeRegion(
      uriString,
      xPx - marginPx,
      yPx - marginPx,
      xPx + wPx + marginPx,
      yPx + hPx + marginPx
    ) ?: return "#ffffff"

    val innerLeft = xPx.coerceIn(region.left, region.right)
    val innerTop = yPx.coerceIn(region.top, region.bottom)
    val innerRight = (xPx + wPx).coerceIn(region.left, region.right)
    val innerBottom = (yPx + hPx).coerceIn(region.top, region.bottom)

    // Fixed-size (0-255) histograms, not a full pixel list - O(1) extra space per channel
    // regardless of how large the sampled band is, while still supporting an exact median.
    val histR = IntArray(256)
    val histG = IntArray(256)
    val histB = IntArray(256)
    var count = 0L
    for (y in region.top until region.bottom) {
      val insideInnerRow = y in innerTop until innerBottom
      for (x in region.left until region.right) {
        if (insideInnerRow && x in innerLeft until innerRight) continue
        val pixel = region.pixel(x, y)
        histR[Color.red(pixel)]++
        histG[Color.green(pixel)]++
        histB[Color.blue(pixel)]++
        count++
      }
    }

    // Degenerate case (e.g. the rectangle fills the whole page, leaving no surrounding band).
    if (count == 0L) return "#ffffff"

    return String.format(
      "#%02x%02x%02x",
      medianOf(histR, count),
      medianOf(histG, count),
      medianOf(histB, count)
    )
  }

  /** Exact median value (0-255) of a 256-bucket histogram holding [count] samples. */
  private fun medianOf(histogram: IntArray, count: Long): Int {
    val half = count / 2
    var runningCount = 0L
    for (value in 0..255) {
      runningCount += histogram[value]
      if (runningCount > half) return value
    }
    return 255
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
   *
   * All parameters are background-image px.
   */
  private fun sampleTextColor(
    uriString: String,
    xPx: Int,
    yPx: Int,
    wPx: Int,
    hPx: Int
  ): String {
    val insetX = (wPx * 0.08).toInt().coerceAtMost(wPx / 4)
    val insetY = (hPx * 0.08).toInt().coerceAtMost(hPx / 4)
    val region = decodeRegion(
      uriString,
      xPx + insetX,
      yPx + insetY,
      xPx + wPx - insetX,
      yPx + hPx - insetY
    ) ?: return "#15172c"

    val histR = IntArray(256)
    val histG = IntArray(256)
    val histB = IntArray(256)
    val totalPixels = region.pixels.size.toLong()
    if (totalPixels == 0L) return "#15172c"

    // Step 1: Collect channel histograms to find the background color (median of each channel)
    for (pixel in region.pixels) {
      histR[Color.red(pixel)]++
      histG[Color.green(pixel)]++
      histB[Color.blue(pixel)]++
    }

    val bgR = medianOf(histR, totalPixels)
    val bgG = medianOf(histG, totalPixels)
    val bgB = medianOf(histB, totalPixels)

    // Step 2: Measure distance from background for all pixels
    val distCounts = LongArray(766)
    val distRedSums = LongArray(766)
    val distGreenSums = LongArray(766)
    val distBlueSums = LongArray(766)
    var maxDist = 0

    for (pixel in region.pixels) {
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
