package expo.modules.pdfpageimage

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import java.io.Serializable

/**
 * @param uri a `file://` URI to the rendered JPEG, in the app's cache directory.
 * @param width rendered bitmap width, in px. Normally page width in pt * the requested scale, but
 *   lower for very large pages (see PdfRenderService's pixel cap), so never divide by the scale.
 * @param height rendered bitmap height, in px (same caveat as [width]).
 * @param widthPt page width, in PDF points.
 * @param heightPt page height, in PDF points.
 */
@OptimizedRecord
internal class PageImageResult(
  @Field var uri: String = "",
  @Field var width: Int = 0,
  @Field var height: Int = 0,
  @Field var widthPt: Int = 0,
  @Field var heightPt: Int = 0
) : Record, Serializable
