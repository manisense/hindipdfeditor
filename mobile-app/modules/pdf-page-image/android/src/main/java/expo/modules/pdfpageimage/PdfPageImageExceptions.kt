package expo.modules.pdfpageimage

import expo.modules.kotlin.exception.CodedException

class PdfOpenFailedException(uri: String, cause: Throwable) :
  CodedException("Failed to open PDF at $uri: ${cause.message}", cause)

class PdfPageNotFoundException(page: Int, pageCount: Int) :
  CodedException("Page $page does not exist in this document (it has $pageCount page(s)).")

class ColorSampleFailedException(uri: String, cause: Throwable) :
  CodedException("Failed to sample background color from $uri: ${cause.message}", cause)
