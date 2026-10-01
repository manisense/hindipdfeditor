package expo.modules.pdfpageimage

import expo.modules.kotlin.exception.CodedException

class PdfOpenFailedException(uri: String, cause: Throwable) :
  CodedException("Failed to open PDF at $uri: ${cause.message}", cause)

class PdfPageNotFoundException(page: Int, pageCount: Int) :
  CodedException("Page $page does not exist in this document (it has $pageCount page(s)).")

class ColorSampleFailedException(uri: String, cause: Throwable) :
  CodedException("Failed to sample background color from $uri: ${cause.message}", cause)

class PdfRendererCrashedException(uri: String, cause: Throwable) :
  CodedException(
    "The PDF renderer stopped while reading $uri. The file may be damaged or unsupported.",
    cause
  )

class PdfRendererUnavailableException(reason: String) :
  CodedException("The PDF renderer could not be started: $reason")

class PdfRenderFailedException(uri: String, page: Int, reason: String?) :
  CodedException("Failed to render page $page of $uri: $reason")
