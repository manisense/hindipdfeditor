package expo.modules.textrecognition

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.Serializable

/**
 * One recognized line of text with its bounding box. All box fields are in the pixel space of
 * the input image itself (for this app: the rasterized page background JPEG, i.e. the same
 * space as `PageState.imagePxWidth/Height`) - converting to PDF points is the JS caller's job
 * via coordinateMath.ts's `imagePxToPt`/`imagePxSizeToPt`, keeping this module reusable and
 * unit-agnostic about the app's coordinate systems.
 */
internal class OcrLineResult(
  @Field var text: String = "",
  @Field var x: Int = 0,
  @Field var y: Int = 0,
  @Field var width: Int = 0,
  @Field var height: Int = 0
) : Record, Serializable
