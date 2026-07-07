package expo.modules.pdfpageimage

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import java.io.Serializable

/**
 * @param uri a `file://` URI to the rendered JPEG, in the app's cache directory.
 * @param width rendered bitmap width, in px (== page width in PDF points * the requested scale).
 * @param height rendered bitmap height, in px (== page height in PDF points * the requested scale).
 */
@OptimizedRecord
internal class PageImageResult(
  @Field var uri: String = "",
  @Field var width: Int = 0,
  @Field var height: Int = 0
) : Record, Serializable
