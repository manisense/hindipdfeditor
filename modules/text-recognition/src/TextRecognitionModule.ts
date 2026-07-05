import { NativeModule, requireNativeModule } from 'expo';

import { OcrScript, RecognizedLine } from './TextRecognition.types';

declare class TextRecognitionModule extends NativeModule<Record<never, never>> {
  /**
   * Runs on-device ML Kit Text Recognition v2 over the image at `uri` with the given script's
   * bundled model, returning recognized lines with bounding boxes in the image's own pixel
   * space. Fully offline - the models ship inside the APK.
   *
   * @param uri `file://` URI to the image (for this app: a page's rasterized background JPEG).
   * @param script Which script model to run - see `OcrScript`.
   */
  recognizeText(uri: string, script: OcrScript): Promise<RecognizedLine[]>;
}

export default requireNativeModule<TextRecognitionModule>('TextRecognition');
