package expo.modules.pdfpageimage

/**
 * Binder transaction codes and reply status codes shared by [PdfRenderService] (the `:pdfrender`
 * helper process) and [PdfRenderClient] (the app process). Kept in one place so both sides
 * always agree on the wire format, which is a plain [android.os.Parcel] with no AIDL.
 */
internal object PdfRenderProtocol {
  const val DESCRIPTOR = "expo.modules.pdfpageimage.PdfRenderService"

  /** In: fd. Out: status, then pageCount (int) or message (string). */
  const val TRANSACTION_PAGE_COUNT = android.os.IBinder.FIRST_CALL_TRANSACTION

  /**
   * In: fd, pageIndex (int), scale (double, px per PDF point), maxPixels (long, px), output path
   * (string). Out: status, then pxWidth (int, px), pxHeight (int, px), widthPt (int, pt),
   * heightPt (int, pt); or pageCount (int) for [STATUS_PAGE_NOT_FOUND]; or message (string).
   */
  const val TRANSACTION_RENDER = android.os.IBinder.FIRST_CALL_TRANSACTION + 1

  const val STATUS_OK = 0
  const val STATUS_OPEN_FAILED = 1
  const val STATUS_PAGE_NOT_FOUND = 2
  const val STATUS_RENDER_FAILED = 3
}
