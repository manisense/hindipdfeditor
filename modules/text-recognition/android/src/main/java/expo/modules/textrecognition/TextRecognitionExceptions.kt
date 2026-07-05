package expo.modules.textrecognition

import expo.modules.kotlin.exception.CodedException

class ImageLoadFailedException(uri: String, cause: Throwable) :
  CodedException("Failed to load image for OCR from $uri: ${cause.message}", cause)

class RecognitionFailedException(script: String, cause: Throwable) :
  CodedException("ML Kit $script text recognition failed: ${cause.message}", cause)

class UnknownScriptException(script: String) :
  CodedException("Unknown OCR script '$script' - expected 'latin' or 'devanagari'.")
