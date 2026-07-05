package expo.modules.textrecognition

import android.content.Context
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.TextRecognizer
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * In-house Expo Module wrapping Google ML Kit Text Recognition v2 with the *bundled* Latin and
 * Devanagari models (`com.google.mlkit:text-recognition[-devanagari]`), chosen over the
 * unbundled play-services variants so OCR works fully offline from first app launch - no
 * Google Play Services model download, matching this app's local-first design (ADR 0005).
 *
 * Same in-house-over-third-party rationale as `pdf-page-image` (ADR 0004): a thin wrapper over
 * a stable first-party Google API, with no third-party wrapper package in between whose own
 * build setup can rot.
 *
 * This module only *reads* text from an image - it never draws Devanagari text, so it doesn't
 * touch the non-negotiable rendering rule in AGENTS.md.
 */
class TextRecognitionModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  // One long-lived client per script, created on first use. ML Kit clients are expensive to
  // spin up (model load) and are designed to be reused; this app OCRs one page at a time, so
  // two cached clients is the whole working set. Never closed explicitly - they live as long
  // as the process, which is exactly the lifetime we want here.
  private val latinRecognizer: TextRecognizer by lazy {
    TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
  }
  private val devanagariRecognizer: TextRecognizer by lazy {
    TextRecognition.getClient(DevanagariTextRecognizerOptions.Builder().build())
  }

  override fun definition() = ModuleDefinition {
    Name("TextRecognition")

    // script is 'latin' or 'devanagari'. Returned boxes are in the input image's own pixel
    // space - see OcrLineResult's docstring. Uses a manually-resolved Promise because ML Kit's
    // process() API is Task-based (callback) rather than blocking.
    AsyncFunction("recognizeText") { uri: String, script: String, promise: Promise ->
      val recognizer = when (script) {
        "latin" -> latinRecognizer
        "devanagari" -> devanagariRecognizer
        else -> throw UnknownScriptException(script)
      }

      val image = try {
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (e: Exception) {
        throw ImageLoadFailedException(uri, e)
      }

      recognizer.process(image)
        .addOnSuccessListener { result ->
          val lines = mutableListOf<OcrLineResult>()
          for (block in result.textBlocks) {
            for (line in block.lines) {
              // Lines without a bounding box can't be positioned on the page, so they're
              // useless to the editor - skip rather than fabricate a position.
              val box = line.boundingBox ?: continue
              if (line.text.isBlank()) continue
              lines.add(
                OcrLineResult(
                  text = line.text,
                  x = box.left,
                  y = box.top,
                  width = box.width(),
                  height = box.height()
                )
              )
            }
          }
          promise.resolve(lines)
        }
        .addOnFailureListener { e ->
          promise.reject(RecognitionFailedException(script, e))
        }
    }
  }
}
